# The Easy Therapist

A deliberately silly, buildless chat app. Type a thought to receive a random preamble and one of 100 original therapy-sounding questions. It is labeled as a joke, not therapy or mental health advice. There is no AI analysis, medical advice engine, backend, analytics, or external dependency.

Serve the repository and open `/easy-therapist/`. The header returns to the project directory. The homepage and shared navigation link here.

## Behavior

- Shuffles all 100 questions without repetition before starting another cycle; avoids repeating the last question at a cycle boundary.
- Enter sends; Shift + Enter adds a line break. Composition events do not send prematurely.
- Sample prompts fill the composer. “Just ask me something” draws a question without submitting text.
- “Start fresh” clears the tab's conversation and resets the deck and question count.
- Messages use `textContent`, not HTML. No conversation content is stored or transmitted by the app. Reloading clears it.
- Questions are original parody prompts, not a ranked or clinically validated list.

## Checks

`node --check easy-therapist/app.mjs`

Verify the question count and uniqueness by importing `questions` from `questions.mjs`; `createQuestionDeck` accepts an optional random function for deterministic checks.
