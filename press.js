// press.js — génère des questions de conf en FR via OpenAI
const { OpenAI } = require('openai');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PRESS_MODEL = process.env.PRESS_MODEL || 'gpt-4o'; // ou 'gpt-5' si dispo dans ton compte
const NUM_DEFAULT = Math.max(1, parseInt(process.env.PRESS_NUM_DEFAULT || '2', 10));

/**
 * ctx attendu :
 * {
 *   coach: 'Pseudo Discord',
 *   coachName: 'Nom court pour politesse' (optionnel),
 *   team: 'Angers', opp: 'Marseille',
 *   for: 2, against: 1,
 *   scorersFor: ['Guessand (17)'], scorersAgainst: ['Aubameyang (52)'],
 *   phase: 'Ligue 1', homeAway: 'domicile|extérieur' (optionnel),
 *   nationality: 'France', age: 34, currentSeason: '2024-25', matchday: 15,
 *   recentMatches: [
 *     { opponent:'Lyon', result:'2-1', competition:'L1', scorersFor:['X (10)'], scorersAgainst:['Y (68)'] },
 *     ...
 *   ]
 * }
 */
async function generateQuestions(ctx, n = NUM_DEFAULT) {
  const count = Math.min(Math.max(parseInt(n || NUM_DEFAULT, 10), 1), 5);

  // DEBUG - Log du contexte reçu
  console.log('[PRESS DEBUG] Contexte reçu:', {
    team: ctx?.team,
    opp: ctx?.opp,
    for: ctx?.for,
    against: ctx?.against,
    scorersFor: ctx?.scorersFor,
    scorersAgainst: ctx?.scorersAgainst,
    recentMatches: ctx?.recentMatches?.slice(0, 3) // Premiers 3 matchs pour debug
  });

  // Schéma strict : { questions: [{ text: string } ...] }
  const schema = {
    type: "object",
    properties: {
      questions: {
        type: "array",
        minItems: count,
        maxItems: count,
        items: {
          type: "object",
          properties: {
            text: { type: "string" }
          },
          required: ["text"],
          additionalProperties: false
        }
      }
    },
    required: ["questions"],
    additionalProperties: false
  };

  const coachName = ctx?.coachName || ctx?.coach || "—";
  const teamName  = ctx?.team || "votre équipe";
  const oppName   = ctx?.opp  || "l'adversaire";

  // VERIFICATION du match actuel
  const currentScore = Number.isFinite(ctx?.for) && Number.isFinite(ctx?.against) 
    ? `${ctx.for}-${ctx.against}` 
    : "score non défini";
  
  console.log('[PRESS DEBUG] Match actuel analysé:', {
    equipe: teamName,
    adversaire: oppName,
    score: currentScore,
    estVictoire: ctx?.for > ctx?.against,
    estDefaite: ctx?.for < ctx?.against,
    estNul: ctx?.for === ctx?.against
  });

  // HISTORIQUE — 5 derniers matchs formaté (SANS le match actuel si présent)
  const historyLines = Array.isArray(ctx?.recentMatches)
    ? ctx.recentMatches.slice(0, 5).map((match, index) => {
        const result = String(match?.result ?? '0-0');
        const [gf, ga] = result.split('-').map(x => parseInt(x, 10));
        const isWin  = (gf > ga);
        const isDraw = (gf === ga);
        const resultIcon = isWin ? '✅' : (isDraw ? '🟨' : '❌');

        let line = `${index + 1}. ${resultIcon} vs ${match?.opponent ?? '—'} : ${result} (${match?.competition ?? '—'})`;
        if (Array.isArray(match?.scorersFor) && match.scorersFor.length) {
          line += ` - Buteurs: ${match.scorersFor.join(', ')}`;
        }
        if (Array.isArray(match?.scorersAgainst) && match.scorersAgainst.length) {
          line += ` - Encaissés: ${match.scorersAgainst.join(', ')}`;
        }
        return line;
      })
    : [];

  // TENDANCES (si ≥ 3 matchs)
  let trends = [];
  if (Array.isArray(ctx?.recentMatches) && ctx.recentMatches.length >= 3) {
    const last = ctx.recentMatches.slice(0, 5);
    const toNum = (s, i) => (parseInt(String(s).split('-')[i], 10) || 0);

    const wins   = last.filter(m => toNum(m.result,0) > toNum(m.result,1)).length;
    const draws  = last.filter(m => toNum(m.result,0) === toNum(m.result,1)).length;
    const losses = last.filter(m => toNum(m.result,0) < toNum(m.result,1)).length;

    const goalsFor     = last.reduce((sum, m) => sum + toNum(m.result,0), 0);
    const goalsAgainst = last.reduce((sum, m) => sum + toNum(m.result,1), 0);

    const allScorers = last.flatMap(m => Array.isArray(m.scorersFor) ? m.scorersFor : []);
    const scorerStats = {};
    for (const s of allScorers) {
      const name = String(s).split(' (')[0];
      scorerStats[name] = (scorerStats[name] || 0) + 1;
    }
    const topScorerEntry = Object.entries(scorerStats).sort((a, b) => b[1] - a[1])[0];

    trends = [
      `- Série: ${wins}V ${draws}N ${losses}D sur les ${last.length} derniers matchs`,
      `- Buts: ${goalsFor} marqués, ${goalsAgainst} encaissés (moyenne: ${(goalsFor / last.length).toFixed(1)} pour, ${(goalsAgainst / last.length).toFixed(1)} contre)`,
      topScorerEntry ? `- Meilleur buteur récent: ${topScorerEntry[0]} (${topScorerEntry[1]} but${topScorerEntry[1] > 1 ? 's' : ''})` : '',
      (Number.isFinite(ctx?.for) && Number.isFinite(ctx?.against))
        ? `- Aujourd'hui: ${ctx.for > (goalsFor / last.length) ? 'Attaque plus efficace' : ctx.for < (goalsFor / last.length) ? 'Attaque moins efficace' : 'Attaque dans la moyenne'} que la moyenne récente`
        : '',
      ``
    ].filter(Boolean);
  }

  // Construction du prompt final (texte)
  const parts = [
    `Tu es un journaliste sportif expérimenté qui suit le championnat de France de Ligue 1 McDonald's. Tu poses des questions en conférence de presse dans le cadre d'une partie en réseau de Football Manager se déroulant dans ce championnat.`,
    ``,
    `CONTEXTE DU MATCH DONT IL FAUT PARLER (le dernier match joué par l'entraîneur):`,
    `- Entraîneur: ${ctx?.coach || "—"} (coach de ${teamName})`,
    ctx?.nationality ? `- Nationalité de l'entraîneur: ${ctx.nationality}` : '',
    (Number.isFinite(ctx?.age)) ? `- Âge de l'entraîneur: ${ctx.age} ans` : '',
    `- Match joué: ${teamName} ${currentScore} ${oppName}`,
    `- Résultat pour ${teamName}: ${Number.isFinite(ctx?.for) && Number.isFinite(ctx?.against) ? 
      (ctx.for > ctx.against ? `VICTOIRE ${ctx.for}-${ctx.against}` : 
       ctx.for < ctx.against ? `DÉFAITE ${ctx.for}-${ctx.against}` : 
       `MATCH NUL ${ctx.for}-${ctx.against}`) : "résultat non défini"}`,
    `- RAPPEL IMPORTANT: ${teamName} a ${ctx?.for || 0} but(s), ${oppName} a ${ctx?.against || 0} but(s)`,
    Array.isArray(ctx?.scorersFor) && ctx.scorersFor.length ? `- Buteurs de ${teamName}: ${ctx.scorersFor.join(', ')}` : `- AUCUN buteur pour ${teamName} dans ce match`,
    Array.isArray(ctx?.scorersAgainst) && ctx.scorersAgainst.length ? `- Buteurs de ${oppName}: ${ctx.scorersAgainst.join(', ')}` : `- AUCUN buteur pour ${oppName} dans ce match`,
    ctx?.phase ? `- Compétition: ${ctx.phase}` : ``,
    ctx?.currentSeason ? `- Saison: ${ctx.currentSeason}` : '',
    (Number.isFinite(ctx?.matchday)) ? `- Journée: ${ctx.matchday}` : '',
    ``,
    historyLines.length ? `HISTORIQUE RÉCENT DE ${teamName.toUpperCase()} (matchs précédents, du plus récent au plus ancien):` : '',
    ...historyLines,
    historyLines.length ? `` : '',
    trends.length ? `ANALYSE DE TENDANCES POUR ${teamName.toUpperCase()}:` : '',
    ...trends,
    `CONSIGNES POUR LES QUESTIONS:`,
    `- Langue: français soutenu mais accessible.`,
    `- Ton: journalistique professionnel, curieux, parfois légèrement taquin si pertinent.`,
    `- Longueur: 1-2 phrases maximum par question.`,
    `- Politesse: Tu appelles l'entraîneur "coach ${coachName}".`,
    `- IMPÉRATIF: Tu interroges le coach de ${teamName} sur le match ${teamName} ${currentScore} ${oppName} qui vient de se terminer.`,
    `- IMPÉRATIF: Ce match s'est terminé sur le score de ${currentScore} (${ctx?.for || 0} pour ${teamName}, ${ctx?.against || 0} pour ${oppName}).`,
    `- IMPÉRATIF: NE PAS parler de "score vierge" ou "0-0" si le score n'est PAS 0-0 !`,
    `- Varie les angles: tactique, mental, performances individuelles, série en cours, comparaisons avec matchs précédents.`,
    `- Évite les questions trop génériques comme "Vos impressions sur le match ?" — sois PRÉCIS et CONTEXTUEL.`,
    `- Fais référence aux éléments marquants: buteurs du jour, série en cours, performances récentes contre des adversaires similaires.`,
    `- Si des patterns émergent de l'historique (même buteur, même type de résultat, etc.), exploite-les dans tes questions.`,
    `- Adapte le ton selon le résultat de ${teamName}: victoire (satisfaction, ambitions), défaite (analyse, réaction), match nul (frustration/satisfaction selon contexte).`,
    `- ATTENTION: ${teamName} est l'équipe de l'entraîneur interrogé, ${oppName} est son adversaire dans ce match.`,
    ``,
    `EXEMPLES DE QUESTIONS PRÉCISES À PRIVILÉGIER:`,
    Array.isArray(ctx?.scorersFor) && ctx.scorersFor[0]
      ? `- "Coach ${coachName}, ${String(ctx.scorersFor[0]).split(' (')[0]} enchaîne, comment expliquez-vous cette montée en puissance ?"`
      : `- "Coach ${coachName}, sur quoi avez-vous fondé votre plan de jeu face à ${oppName} aujourd'hui ?"`,
  ].filter(Boolean);

  const prompt = parts.join('\n');

  try {
    const resp = await client.chat.completions.create({
      model: PRESS_MODEL,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "PressQs",
          schema: schema
        }
      },
      max_tokens: 400
    });

    // Extraction robuste
    let raw = resp.choices?.[0]?.message?.content;
    if (!raw) {
      return [
        `Quel regard portez-vous sur la prestation globale de votre équipe ?`,
        `Le tournant du match selon vous ?`
      ].slice(0, count);
    }
    if (raw && /^```/m.test(raw)) {
      raw = raw.replace(/^```(?:json)?\s*|\s*```$/g, '');
    }

    let arr = [];
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      arr = parsed?.questions?.map((q) => q.text).filter(Boolean) || [];
    } catch {
      // on tombera sur le fallback
    }

    return arr.length ? arr.slice(0, count) : [
      `Quel regard portez-vous sur la prestation globale de votre équipe ?`,
      `Le tournant du match selon vous ?`
    ].slice(0, count);

  } catch (e) {
    console.error('[PRESS] OpenAI error:', e?.message || e);
    return [
      `Votre analyse à chaud du match ?`,
      `Un mot sur vos choix tactiques aujourd’hui ?`
    ].slice(0, count);
  }
}

module.exports = { generateQuestions };
