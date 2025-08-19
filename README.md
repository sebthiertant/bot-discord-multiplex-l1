# bot_discord_l1_multiplex

## Description

This is a Discord bot designed for French football (Ligue 1) multiplex voice announcements. It joins a voice channel and plays a jingle followed by a synthesized voice commentary when a goal is scored, using Azure Cognitive Services for Text-to-Speech (TTS).

## Features

- Joins Discord voice channels and stays until everyone leaves or toggled off.
- Plays a goal jingle (`assets/but.mp3`) and generates dynamic TTS commentary for goals.
- Supports club-specific and scorer-specific goal announcements.
- Uses Azure Speech for realistic French voice synthesis.
- Command-based interaction via Discord chat.

## Setup & Configuration

### Prerequisites

- Node.js (v16+ recommended)
- Discord bot token
- Azure Cognitive Services Speech resource (key & region)

### Installation

1. Clone the repository.
2. Install dependencies:

   ```sh
   npm install
   ```

3. Configure environment variables:

   - Copy `.exemple.env` to `.env` and fill in your credentials:

     ```
     AZURE_SPEECH_KEY=your_azure_speech_key
     AZURE_SPEECH_REGION=your_azure_region
     DISCORD_TOKEN=your_discord_bot_token
     ```

   - The bot uses these variables for authentication.

4. Place your goal jingle MP3 in the `assets/` folder as `but.mp3`.

### Running the Bot

Start the bot with:

```sh
npm start
```

## Usage

### Commands

- `!multiplex`  
  Toggles the bot in your current voice channel. The bot stays until everyone leaves or you run the command again.

- `!but[-club][-scorer]`  
  Announces a goal.  
  Examples:  
  - `!but` (generic)  
  - `!but-angers` (club-specific)  
  - `!but-angers-diony` (club and scorer)

## Files Overview

- [`index.js`](index.js): Main bot logic and Discord integration.
- [`tts.js`](tts.js): Azure TTS synthesis and SSML generation.
- [`clubs.js`](clubs.js): Club-specific goal announcement templates.
- [`scorer.js`](scorer.js): Scorer-specific commentary templates.
- [`openers.js`](openers.js): Opening phrases for goal announcements.
- [`assets/but.mp3`](assets/but.mp3): Goal jingle audio.

## Notes

- The bot deletes temporary TTS files after playback.
- Make sure your Azure Speech resource supports the French voice used (`fr-FR-HenriNeural`).
- The bot requires permission to join and speak in voice channels.