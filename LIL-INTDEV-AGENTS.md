# LIL-INTDEV Agent Guidelines

## URL / Query Parser Rules

The source of truth for all URL and query-parameter parsing behavior is [`SCENARIOS.md`](./SCENARIOS.md).

- **v1 acceptance contract** — `SCENARIOS.md` sections 1–13 define every valid and invalid input for the `equity=` query parser. Any behavior not listed there is undefined and must be rejected.
- **End-to-end scenarios** — `SCENARIOS.md` sections A1–A23 cover the full user experience including benchmarks, time ranges, error states, and auth-free operation.
- **When adding or changing parser behavior**, update `SCENARIOS.md` first, then update tests to match. Tests must cover every scenario listed in the document.
- **When tests fail**, check `SCENARIOS.md` to determine whether the test or the implementation is wrong. The scenarios file is the contract — implementation follows it, not the other way around.
