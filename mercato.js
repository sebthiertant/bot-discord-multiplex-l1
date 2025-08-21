// mercato.js - Annonces de transferts à la Fabrizio Romano

const { synthToFile } = require('./tts.js');
const path = require('path');

// Voix italienne masculine pour Fabrizio Romano
const FABRIZIO_VOICE = "it-IT-GiuseppeNeural"

/**
 * Génère et sauvegarde l'annonce mercato
 */
async function generateMercatoAnnouncement(playerName, amount, fromClub, toClub, coachName = null) {
  const timestamp = Date.now();
  const filePath = path.join('assets', `mercato_${timestamp}.mp3`);
  
  // Construire le texte complet pour l'audio (version nettoyée pour TTS)
  const audioText = buildMercatoAudioText(playerName, amount, fromClub, toClub, coachName);
  const ssml = buildMercatoSSML(audioText);
  
  try {
    // Utiliser directement le SSML avec synthToFile
    await synthToFileSSML(ssml, filePath);
    return filePath;
  } catch (error) {
    console.error('[MERCATO] Erreur génération audio:', error);
    throw error;
  }
}

/**
 * Construit le texte pour l'audio (sans emojis ni markdown)
 */
function buildMercatoAudioText(playerName, amount, fromClub, toClub, coachName = null) {
  let text = `BREAKING NEWS! ${playerName} to ${toClub}... HERE WE GO!`;
  
  if (coachName) {
    text += ` The player is really happy to play under the coach ${coachName}.`;
  }
  
  text += ` Deal done and sealed for ${amount} million euros from ${fromClub}. HERE WE GO!`;
  
  return text;
}

/**
 * Génère le texte SSML pour l'annonce mercato avec pauses et accent
 */
function buildMercatoSSML(audioText) {
  // Construction du texte avec pauses stratégiques
  const ssml = `
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
  <voice name="${FABRIZIO_VOICE}">
    <prosody rate="medium" pitch="+5%" volume="loud">
      ${audioText.replace(/BREAKING NEWS!/g, '<emphasis level="strong">BREAKING NEWS!</emphasis><break time="800ms"/>')
                 .replace(/HERE WE GO!/g, '<emphasis level="strong">HERE</emphasis><break time="300ms"/><emphasis level="strong">WE</emphasis><break time="300ms"/><emphasis level="strong">GO!</emphasis><break time="600ms"/>')}
    </prosody>
  </voice>
</speak>`.trim();

  return ssml;
}

/**
 * Version modifiée de synthToFile pour accepter du SSML direct
 */
async function synthToFileSSML(ssmlContent, outPath) {
  const sdk = require("microsoft-cognitiveservices-speech-sdk");
  
  const speechConfig = sdk.SpeechConfig.fromSubscription(
    process.env.AZURE_SPEECH_KEY,
    process.env.AZURE_SPEECH_REGION
  );

  // Format MP3 pour Discord
  try {
    speechConfig.speechSynthesisOutputFormat =
      sdk.SpeechSynthesisOutputFormat.Audio48Khz192KBitRateMonoMp3;
  } catch {
    speechConfig.setProperty(
      sdk.PropertyId.SpeechServiceConnection_SynthOutputFormat,
      "audio-48khz-192kbitrate-mono-mp3"
    );
  }

  const audioConfig = sdk.AudioConfig.fromAudioFileOutput(outPath);
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

  return new Promise((resolve, reject) => {
    synthesizer.speakSsmlAsync(
      ssmlContent,
      (result) => {
        synthesizer.close();
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          resolve(outPath);
        } else {
          reject(new Error(result.errorDetails || "Mercato TTS failed"));
        }
      },
      (err) => {
        synthesizer.close();
        reject(err);
      }
    );
  });
}

/**
 * Construit le texte d'affichage pour Discord
 */
function buildMercatoDisplayText(playerName, amount, fromClub, toClub, coachName = null) {
  const coachLine = coachName ? `The player is really happy to play under the coach **${coachName}**.\n\n` : '';

  return `🚨 **BREAKING NEWS** 🚨\n\n` +
         `**${playerName}** to **${toClub}** : **HERE WE GO** ✅\n\n` +
         coachLine +
         `Deal done and sealed for **€${amount}M** from **${fromClub}**.\n\n` +
         `**HERE WE GO** 🔥`;
}

module.exports = {
  generateMercatoAnnouncement,
  buildMercatoDisplayText
};
