// press.js — génère des questions de conf en FR via OpenAI
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PRESS_MODEL = process.env.PRESS_MODEL || 'gpt-4o';
const NUM_DEFAULT = Math.max(1, parseInt(process.env.PRESS_NUM_DEFAULT || '3', 10));

// Charger la liste des journalistes
let journalists = [];
try {
  const journalistData = fs.readFileSync(path.join(__dirname, 'journalist.json'), 'utf8');
  journalists = JSON.parse(journalistData);
} catch (error) {
  console.error('[PRESS] Erreur chargement journalistes:', error);
  journalists = [];
}

/**
 * Sélectionne un journaliste aléatoire
 */
function getRandomJournalist() {
  if (!journalists.length) {
    return {
      id: 0,
      name: 'Journaliste',
      media: 'Média Sport',
      persona: 'Journaliste sportif professionnel',
      voice: null // Pas de config voice = utilise les défauts
    };
  }
  return journalists[Math.floor(Math.random() * journalists.length)];
}

/**
 * Récupère un journaliste par son ID
 */
function getJournalistById(id) {
  const journalist = journalists.find(j => j.id === id);
  if (!journalist) {
    console.warn(`[PRESS] Journaliste ID ${id} introuvable, utilisation d'un journaliste aléatoire`);
    return getRandomJournalist();
  }
  return journalist;
}

/**
 * Retourne la liste de tous les journalistes (pour debug)
 */
function getAllJournalists() {
  return journalists.map(j => ({ id: j.id, name: j.name, media: j.media }));
}

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
 * journalistId: (optionnel) ID spécifique du journaliste à utiliser
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function generateQuestions(ctx, n = NUM_DEFAULT, journalistId = null) {
  const count = Math.min(Math.max(parseInt(n || NUM_DEFAULT, 10), 1), 5);
  const journalist = journalistId ? getJournalistById(journalistId) : getRandomJournalist();

  // DEBUG - Log du contexte reçu
  console.log('[PRESS DEBUG] Contexte reçu:', {
    team: ctx?.team,
    opp: ctx?.opp,
    for: ctx?.for,
    against: ctx?.against,
    requestedQuestions: count,
    journalistId: journalistId,
    selectedJournalist: journalist?.name
  });

  const questionsToGenerate = Math.max(count + 2, 5);

  const schema = {
    type: 'object',
    properties: {
      presentation: {
        type: 'string',
        maxLength: 100,
      },
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              maxLength: 200,
            },
          },
          required: ['text'],
          additionalProperties: false,
        },
        minItems: questionsToGenerate,
        maxItems: questionsToGenerate,
      },
    },
    required: ['presentation', 'questions'],
    additionalProperties: false,
  };

  const coachName = ctx?.coachName || ctx?.coach || '—';
  const teamName = ctx?.team || 'votre équipe';
  const oppName = ctx?.opp || "l'adversaire";

  // Vérification du score actuel
  const currentScore =
    Number.isFinite(ctx?.for) && Number.isFinite(ctx?.against)
      ? `${ctx.for}-${ctx.against}`
      : 'score non défini';

  // Historique (3 derniers matchs)
  const historyLines = Array.isArray(ctx?.recentMatches)
    ? ctx.recentMatches.slice(0, 3).map((match, index) => {
        const result = String(match?.result ?? '0-0');
        const [gf, ga] = result.split('-').map((x) => parseInt(x, 10));
        const resultIcon = gf > ga ? '✅' : gf === ga ? '🟨' : '❌';
        return `${index + 1}. ${resultIcon} vs ${match?.opponent ?? '—'} : ${result}`;
      })
    : [];

  // Tendances
  let trends = [];
  if (Array.isArray(ctx?.recentMatches) && ctx.recentMatches.length >= 3) {
    const last = ctx.recentMatches.slice(0, 3);
    const toNum = (s, i) => parseInt(String(s).split('-')[i], 10) || 0;

    const wins = last.filter((m) => toNum(m.result, 0) > toNum(m.result, 1)).length;
    const draws = last.filter((m) => toNum(m.result, 0) === toNum(m.result, 1)).length;
    const losses = last.filter((m) => toNum(m.result, 0) < toNum(m.result, 1)).length;

    const goalsFor = last.reduce((sum, m) => sum + toNum(m.result, 0), 0);
    const goalsAgainst = last.reduce((sum, m) => sum + toNum(m.result, 1), 0);

    const allScorers = last.flatMap((m) => (Array.isArray(m.scorersFor) ? m.scorersFor : []));
    const scorerStats = {};
    for (const s of allScorers) {
      const name = String(s).split(' (')[0];
      scorerStats[name] = (scorerStats[name] || 0) + 1;
    }
    const topScorerEntry = Object.entries(scorerStats).sort((a, b) => b[1] - a[1])[0];

    const attackAvg = goalsFor / last.length;
    const todayAttack =
      Number.isFinite(ctx?.for) && ctx.for > attackAvg
        ? 'Attaque plus efficace'
        : Number.isFinite(ctx?.for) && ctx.for < attackAvg
        ? 'Attaque moins efficace'
        : Number.isFinite(ctx?.for)
        ? 'Attaque dans la moyenne'
        : '';

    trends = [
      `- Série: ${wins}V ${draws}N ${losses}D sur les ${last.length} derniers matchs`,
      `- Buts: ${goalsFor} marqués, ${goalsAgainst} encaissés (moyenne: ${(goalsFor / last.length).toFixed(
        1
      )} pour, ${(goalsAgainst / last.length).toFixed(1)} contre)`,
      topScorerEntry
        ? `- Meilleur buteur récent: ${topScorerEntry[0]} (${topScorerEntry[1]} but${
            topScorerEntry[1] > 1 ? 's' : ''
          })`
        : '',
      todayAttack ? `- Aujourd'hui: ${todayAttack} que la moyenne récente` : '',
    ].filter(Boolean);
  }

  // Construction du prompt final
  const parts = [
    `Tu es ${journalist.name}, journaliste pour ${journalist.media}.`,
    `PERSONA: ${journalist.persona}`,
    ``,
    `Tu animes une conférence de presse avec l'entraîneur ${coachName} de ${teamName} après le match qui vient de se terminer.`,
    ``,
    `RÈGLES DE PERSONNALITÉ:`,
    `- Adopte fortement le style et la personnalité décrits dans ton persona.`,
    `- Respecte ton caractère de journaliste (incisif, diplomate, humoristique, etc. selon ton persona) et force les traits au maximum.`,
    `- Commence TOUJOURS par te présenter: "Bonjour coach ${coachName}, ${journalist.name} pour ${journalist.media}."`,
    `- Tes questions doivent refléter ton style journalistique personnel.`,
    ``,
    `CONTEXTE DU MATCH DONT IL FAUT PARLER (le dernier match joué par l'entraîneur):`,
    `- Entraîneur: ${ctx?.coach || '—'} (coach de ${teamName})`,
    ctx?.nationality ? `- Nationalité de l'entraîneur: ${ctx.nationality}` : '',
    Number.isFinite(ctx?.age) ? `- Âge de l'entraîneur: ${ctx.age} ans` : '',
    `- Match joué: ${teamName} ${currentScore} ${oppName}`,
    `- Résultat pour ${teamName}: ${
      Number.isFinite(ctx?.for) && Number.isFinite(ctx?.against)
        ? ctx.for > ctx.against
          ? `VICTOIRE ${ctx.for}-${ctx.against}`
          : ctx.for < ctx.against
          ? `DÉFAITE ${ctx.for}-${ctx.against}`
          : `MATCH NUL ${ctx.for}-${ctx.against}`
        : 'résultat non défini'
    }`,
    `- RAPPEL IMPORTANT: ${teamName} a ${ctx?.for || 0} but(s), ${oppName} a ${ctx?.against || 0} but(s)`,
    Array.isArray(ctx?.scorersFor) && ctx.scorersFor.length
      ? `- Buteurs de ${teamName}: ${ctx.scorersFor.join(', ')}`
      : `- AUCUN buteur pour ${teamName} dans ce match`,
    Array.isArray(ctx?.scorersAgainst) && ctx.scorersAgainst.length
      ? `- Buteurs de ${oppName}: ${ctx.scorersAgainst.join(', ')}`
      : `- AUCUN buteur pour ${oppName} dans ce match`,
    ctx?.phase ? `- Compétition: ${ctx.phase}` : ``,
    ctx?.currentSeason ? `- Saison: ${ctx.currentSeason}` : '',
    Number.isFinite(ctx?.matchday) ? `- Journée: ${ctx.matchday}` : '',
    ``,
    historyLines.length
      ? `HISTORIQUE RÉCENT DE ${teamName.toUpperCase()} (matchs précédents, du plus récent au plus ancien):`
      : '',
    ...historyLines,
    historyLines.length ? `` : '',
    trends.length ? `ANALYSE DE TENDANCES POUR ${teamName.toUpperCase()}:` : '',
    ...trends,
    `CONSIGNES POUR LES QUESTIONS:`,
    `- Langue: français soutenu mais accessible.`,
    `- Ton: ADAPTE-TOI À TON PERSONA ! ${journalist.persona}`,
    `- Longueur: 1-2 phrases maximum par question.`,
    `- Politesse: Tu appelles l'entraîneur "coach ${coachName}".`,
    `- IMPÉRATIF: Tu interroges le coach de ${teamName} sur le match ${teamName} ${currentScore} ${oppName} qui vient de se terminer.`,
    `- IMPÉRATIF: Ce match s'est terminé sur le score de ${currentScore} (${ctx?.for || 0} pour ${teamName}, ${ctx?.against || 0} pour ${oppName}).`,
    `- IMPÉRATIF: NE PAS parler de "score vierge" ou "0-0" si le score n'est PAS 0-0 !`,
    `- Varie les angles selon TON STYLE: tactique, mental, performances individuelles, série en cours, comparaisons avec matchs précédents.`,
    `- Utilise TOUJOURS des angles différents dans tes questions ET adapte-les à ta personnalité de journaliste.`,
    `- Évite les questions trop génériques — sois PRÉCIS, CONTEXTUEL et FIDÈLE À TON PERSONA.`,
    `- Fais référence aux éléments marquants: buteurs du jour (${
      Array.isArray(ctx?.scorersFor) && ctx.scorersFor.length ? ctx.scorersFor.join(', ') : 'AUCUN'
    }), série en cours, performances récentes contre des adversaires similaires.`,
    `- Adapte le ton selon le résultat de ${teamName} ET ton persona: victoire (satisfaction, ambitions), défaite (analyse, réaction), match nul (frustration/satisfaction selon contexte).`,
    `- ATTENTION: ${teamName} est l'équipe de l'entraîneur interrogé, ${oppName} est son adversaire dans ce match.`,
  ].filter(Boolean);

  const prompt = parts.join('\n');

  try {
    const resp = await client.chat.completions.create({
      model: PRESS_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'PressQs',
          schema,
        },
      },
      max_tokens: 1000, // AUGMENTÉ: plus de tokens pour plus de questions
    });

    // Extraction robuste
    let raw = resp.choices?.[0]?.message?.content;
    console.log('[PRESS DEBUG] Contenu brut reçu:', raw);

    if (!raw) {
      return {
        presentation: `Bonjour coach ${coachName}, ${journalist.name} pour ${journalist.media}.`,
        questions: [
          'Quel regard portez-vous sur la prestation globale de votre équipe ?',
          'Le tournant du match selon vous ?',
          'Comment analysez-vous cette performance ?',
        ].slice(0, count),
        journalist,
      };
    }

    // Retirer d'éventuels fences markdown
    if (raw && /^```/m.test(raw)) {
      raw = raw.replace(/^```(?:json)?\s*|\s*```$/g, '');
    }

    const fallback = {
      presentation: `Bonjour coach ${coachName}, ${journalist.name} pour ${journalist.media}.`,
      questions: [],
    };

    let result = { ...fallback };
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      result.presentation = parsed?.presentation || fallback.presentation;

      // Supporte { questions: [{text:"..."}, ...] } ou { questions: ["...", "..."] }
      const parsedQs =
        parsed?.questions?.map?.((q) => (typeof q === 'string' ? q : q?.text)).filter(Boolean) ||
        [];

      // NOUVEAU: Sélection aléatoire des questions
      if (parsedQs.length > count) {
        const shuffledQuestions = shuffleArray(parsedQs);
        result.questions = shuffledQuestions.slice(0, count);
        console.log(`[PRESS DEBUG] ${parsedQs.length} questions générées, ${count} sélectionnées aléatoirement`);
      } else {
        result.questions = parsedQs.slice(0, count);
        console.log(`[PRESS DEBUG] ${parsedQs.length} questions générées, toutes utilisées`);
      }
    } catch (err) {
      console.error('[PRESS DEBUG] Erreur parsing JSON:', err, 'Contenu:', raw);
      // on garde les valeurs par défaut
    }

    if (!result.questions.length) {
      result.questions = [
        'Quel regard portez-vous sur la prestation globale de votre équipe ?',
        'Le tournant du match selon vous ?',
        'Comment analysez-vous cette performance ?',
      ].slice(0, count);
    }

    return {
      presentation: result.presentation,
      questions: result.questions, // Déjà limitées au bon nombre
      journalist, // retourner le journaliste sélectionné
    };
  } catch (e) {
    console.error('[PRESS] OpenAI error:', e?.message || e);
    return {
      presentation: `Bonjour coach ${coachName}, ${journalist.name} pour ${journalist.media}.`,
      questions: [
        "Votre analyse à chaud du match ?",
        "Un mot sur vos choix tactiques aujourd'hui ?",
        "Comment analysez-vous cette performance ?",
      ].slice(0, count),
      journalist,
    };
  }
}

module.exports = { generateQuestions, getAllJournalists };
