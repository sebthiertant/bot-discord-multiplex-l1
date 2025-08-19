// tts.js  (CommonJS, Azure)
// Lecture homogène (même intensité sur toute la phrase)

const sdk = require("microsoft-cognitiveservices-speech-sdk");

// Réglages par défaut (ajustables via .env si tu veux)
const DEFAULT_VOICE = process.env.AZURE_VOICE || "fr-FR-HenriNeural";
const DEG       = Number(process.env.AZURE_DEG || 1.7);    // 1.1–2.0
const RATE_PCT  = Number(process.env.AZURE_RATE || 2);     // %
const PITCH_ST  = Number(process.env.AZURE_PITCH || -1.2); // demi-tons (négatif = plus grave)
const STYLE     = process.env.AZURE_STYLE || "excited";    // "excited" ou "cheerful"

async function synthToFile(text, outPath, voiceName = DEFAULT_VOICE) {
  const speechConfig = sdk.SpeechConfig.fromSubscription(
    process.env.AZURE_SPEECH_KEY,
    process.env.AZURE_SPEECH_REGION
  );

  // Format MP3 propre pour Discord (v1.45: assignation ou setProperty)
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
  const audioConfig = sdk.AudioConfig.fromAudioFileOutput(outPath);

  const ssml = buildSSML(text, voiceName);
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

function buildSSML(text, voiceName) {
  const safe = escapeXml(String(text));
  const body = `
    <mstts:express-as style="${STYLE}" styledegree="${DEG}">
      <prosody rate="${RATE_PCT >= 0 ? '+' : ''}${RATE_PCT}%"
               pitch="${PITCH_ST >= 0 ? '+' : ''}${PITCH_ST}st">
        ${safe}
      </prosody>
    </mstts:express-as>
  `;
  return `
<speak version="1.0"
       xmlns="http://www.w3.org/2001/10/synthesis"
       xmlns:mstts="https://www.w3.org/2001/mstts"
       xml:lang="fr-FR">
  <voice name="${voiceName}" xml:lang="fr-FR">
    ${body}
  </voice>
</speak>`.trim();
}

function buildSimpleSSML(text, voiceName) {
  const safe = escapeXml(String(text));
  return `
<speak version="1.0"
       xmlns="http://www.w3.org/2001/10/synthesis"
       xml:lang="fr-FR">
  <voice name="${voiceName}" xml:lang="fr-FR">
    ${safe}
  </voice>
</speak>`.trim();
}

function speakSsmlAsync(speechConfig, audioConfig, ssml) {
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);
  return new Promise((resolve, reject) => {
    synthesizer.speakSsmlAsync(
      ssml,
      (result) => {
        synthesizer.close();
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) resolve();
        else reject(new Error(result.errorDetails || "TTS failed"));
      },
      (err) => { synthesizer.close(); reject(err); }
    );
  });
}

function escapeXml(s) {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c])
  );
}

module.exports = { synthToFile };
