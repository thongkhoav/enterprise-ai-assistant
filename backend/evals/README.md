# Eval Set

`questions.jsonl` is a starter regression set.

Each line contains:

- `question`: user input
- `expected_route`: expected LangGraph route
- `answer_keywords`: words that should appear in the answer

Next steps:

- Add expected sources for retrieval checks.
- Add graded rubrics for answer completeness.
- Add a separate adversarial set for prompt-injection and unsafe tool calls.

