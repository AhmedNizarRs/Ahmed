# Motion graphics projects (HyperFrames)

Built from the "Motion graphics with Claude Code" guide + starter kit (`../prompts.md`).
Render any project: `cd projects/<name> && npx hyperframes render . -o renders/<file>.mp4`

| Folder | Prompt | Output |
|---|---|---|
| 02-first-render | 02 | renders/first.mp4 |
| 03-moves | 03 | renders/moves.mp4 |
| 08-text-only/base | 08 | renders/text.mp4 |
| 08-text-only/style-kinetic | 08 + 04 | renders/kinetic.mp4 |
| 08-text-only/style-glass | 08 + 05 | renders/glass.mp4 |
| 08-text-only/style-editorial | 08 + 06 | renders/editorial.mp4 |
| 08-text-only/style-pop | 08 + 07 | renders/pop.mp4 |
| 09-product | 09 | renders/product.mp4 |
| 10-saas-promo | 10 | renders/promo.mp4 (60s, kinetic style, uses practice screenshots) |
| 14-transparent | 14 | renders/card.mov + renders/card-png (git-ignored: 80 MB; re-render with `--format mov` / `--format png-sequence`) |


Prompts 11–13 are done in `11-own-video` (transcript in `transcript.json`; renders/with-cards.mp4 = graphics + screenshots + sound effects).
Note: whisper-cli was built from ggml-org/whisper.cpp inside the cloud container (not in this repo) and the `ggml-small.en.bin` model sits in ~/.cache/hyperframes/whisper/models.
