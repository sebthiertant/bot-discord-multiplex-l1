// tts.js  (CommonJS, Azure)
// Lecture homogène (même intensité sur toute la phrase)

const sdk = require("microsoft-cognitiveservices-speech-sdk");

// Réglages par défaut (ajustables via .env si tu veux)
const DEFAULT_VOICE = process.env.AZURE_VOICE || "fr-FR-HenriNeural";
const DEG       = Number(process.env.AZURE_DEG || 1.7);    // 1.1–2.0
const RATE_PCT  = Number(process.env.AZURE_RATE || 2);     // % (négatif = plus lent)
const PITCH_ST  = Number(process.env.AZURE_PITCH || -1.2); // demi-tons (négatif = plus grave)
const STYLE     = process.env.AZURE_STYLE || "excited";    // "excited" ou "cheerful"

async function synthToFile(text, outPath, voiceName = DEFAULT_VOICE, customParams = null) {
  const speechConfig = sdk.SpeechConfig.fromSubscription(
    process.env.AZURE_SPEECH_KEY,
    process.env.AZURE_SPEECH_REGION
  );

  // Format MP3 propre pour Discord - FIX: définir AVANT AudioConfig
  try {
    speechConfig.speechSynthesisOutputFormat =
      sdk.SpeechSynthesisOutputFormat.Audio48Khz192KBitRateMonoMp3;
  } catch {
    speechConfig.setProperty(
      sdk.PropertyId.SpeechServiceConnection_SynthOutputFormat,
      "audio-48khz-192kbitrate-mono-mp3"
    );
  }

  speechConfig.speechSynthesisVoiceName = voiceName;
  
  // FIX: Créer AudioConfig APRÈS avoir défini le format
  const audioConfig = sdk.AudioConfig.fromAudioFileOutput(outPath);

  const ssml = buildSSML(text, voiceName, customParams);
  try {
    await speakSsmlAsync(speechConfig, audioConfig, ssml);
    return outPath;
  } catch (e) {
    console.warn("[TTS] SSML refusé, fallback simple…", e?.message || e);
    const fallback = buildSimpleSSML(text, voiceName);
    await speakSsmlAsync(speechConfig, audioConfig, fallback);
    return outPath;
  }
}

function buildSSML(text, voiceName, customParams = null) {
  const safe = escapeXml(String(text));
  
  // Utiliser les paramètres personnalisés ou les valeurs par défaut
  const params = customParams || {};
  const degree = params.degree !== undefined ? params.degree : DEG;
  const rate = params.rate !== undefined ? params.rate : RATE_PCT;
  const pitch = params.pitch !== undefined ? params.pitch : PITCH_ST;
  const style = params.style || STYLE;
  
  // Déterminer la langue en fonction de la voix
  const voiceLang = voiceName.startsWith('es-ES') ? 'es-ES' : 
                   voiceName.startsWith('en-US') ? 'en-US' : 
                   voiceName.startsWith('it-IT') ? 'it-IT' : 
                   voiceName.startsWith('de-DE') ? 'de-DE' : 
                   'fr-FR';
  
  const body = `
    <mstts:express-as style="${style}" styledegree="${degree}">
      <prosody rate="${rate >= 0 ? '+' : ''}${rate}%"
               pitch="${pitch >= 0 ? '+' : ''}${pitch}st">
        ${safe}
      </prosody>
    </mstts:express-as>
  `;
  return `
<speak version="1.0"
       xmlns="http://www.w3.org/2001/10/synthesis"
       xmlns:mstts="https://www.w3.org/2001/mstts"
       xml:lang="${voiceLang}">
  <voice name="${voiceName}" xml:lang="${voiceLang}">
    ${body}
  </voice>
</speak>`.trim();
}

function buildSimpleSSML(text, voiceName) {
  const safe = escapeXml(String(text));
  
  // Déterminer la langue en fonction de la voix
  const voiceLang = voiceName.startsWith('es-ES') ? 'es-ES' : 
                   voiceName.startsWith('en-US') ? 'en-US' : 
                   voiceName.startsWith('it-IT') ? 'it-IT' : 
                   voiceName.startsWith('de-DE') ? 'de-DE' : 
                   'fr-FR';
  
  return `
<speak version="1.0"
       xmlns="http://www.w3.org/2001/10/synthesis"
       xml:lang="${voiceLang}">
  <voice name="${voiceName}" xml:lang="${voiceLang}">
    ${safe}
  </voice>
</speak>`.trim();
}

function speakSsmlAsync(speechConfig, audioConfig, ssml) {
  return new Promise((resolve, reject) => {
    // FIX: Créer un nouveau synthesizer à chaque appel pour éviter les conflits
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);
    
    synthesizer.speakSsmlAsync(
      ssml,
      (result) => {
        synthesizer.close();
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          resolve();
        } else {
          reject(new Error(result.errorDetails || "TTS failed"));
        }
      },
      (err) => { 
        synthesizer.close(); 
        reject(err); 
      }
    );
  });
}

function escapeXml(s) {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c])
  );
}

module.exports = { synthToFile };
