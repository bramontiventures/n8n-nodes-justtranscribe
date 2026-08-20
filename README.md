# n8n-nodes-justtranscribe

An [n8n](https://n8n.io) community node for [JustTranscribe](https://justtranscribe.ai) —
transcribe audio/video files and public video links into accurate, timestamped
text, right inside your workflows.

- **Sources**: binary files from any previous node (MP3, WAV, M4A, OGG/OPUS —
  including WhatsApp voice notes — FLAC, MP4, MOV, WEBM, MKV; up to 500 MB /
  150 minutes) or public links from YouTube, TikTok, Instagram, Facebook,
  Pinterest and Google Drive.
- **Output**: word-timed segments, detected language, an AI summary with key
  moments (and, for social videos, a hook/scenes/pacing breakdown), plus
  exports to SRT, VTT, TXT, CSV, Markdown, PDF and DOCX.
- **Built-in waiting**: *Create* can poll until the transcript is finished, so
  most workflows need no extra Wait/loop nodes.
- Spanish-first (native LATAM Spanish product) and English.

## Installation

**Self-hosted n8n**: *Settings → Community Nodes → Install* →
`n8n-nodes-justtranscribe`.

**n8n Cloud**: search for “JustTranscribe” in the nodes panel once the node is
verified.

## Credentials

1. Create a free account at [justtranscribe.ai](https://justtranscribe.ai)
   (no card during the beta).
2. Go to **Profile → API keys**, create a key (`jt_live_…`) and copy it —
   it is shown only once.
3. In n8n, create a **JustTranscribe API** credential and paste the key.

Full API reference: <https://justtranscribe.ai/developers>.

## Operations

| Resource | Operation | What it does |
| --- | --- | --- |
| Transcript | **Create** | Transcribe a public video URL **or a binary file**; optionally wait until finished (default on) |
| Transcript | **Get** | Status + timestamped segments + language + AI analysis |
| Transcript | **List** | Newest first, with limit/offset and a status filter |
| Transcript | **Export** | SRT, VTT, TXT, CSV, Markdown (into the item JSON) or PDF, DOCX (into a binary field); optional timestamps and cached speaker labels |
| Transcript | **Delete** | Remove the transcript and its stored media |
| Account | **Get** | The account behind the API key (also the credential test) |

## Example: WhatsApp voice note ➜ text in a Google Sheet

1. A trigger delivers the audio file (e.g. a WhatsApp/Telegram integration or
   a Read Binary File node).
2. **JustTranscribe → Transcript → Create** with *Source: Binary File* and
   *Wait Until Finished* on.
3. Use `{{ $json.transcript.segments }}` for the timed segments, or add
   **Transcript → Export** (format `txt`) and use `{{ $json.content }}`.
4. Append to your sheet.

## Limits (free beta)

3 new transcripts per hour per account, one processing at a time, 120
requests/minute per key. Files up to 150 minutes / 500 MB. Private or
login-only videos can't be fetched — pass the file instead.

## Resources

- [API documentation](https://justtranscribe.ai/developers)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)

## License

[MIT](LICENSE.md) © Bramonti Ventures
