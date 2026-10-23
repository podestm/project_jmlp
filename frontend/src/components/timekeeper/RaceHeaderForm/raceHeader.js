// Údaje závodu do hlavičky výsledkové listiny (TkHlavickaZavodu): převod
// mezi odpovědí GET /races/{id}/detail, formulářem a tělem PUT.

/** Obě kola se nabízejí vždy; nevyplněné se do listiny netiskne. */
export const RUN_NUMBERS = [1, 2];

const RUN_FIELDS = ['course_setter', 'gates_count', 'conditions', 'start_time', 'course_length_m'];

const toFormRun = (runNumber, run) => ({
  run_number: runNumber,
  ...Object.fromEntries(RUN_FIELDS.map((field) => [field, run?.[field] ?? ''])),
});

/** Formulář z detailu závodu; chybějící kolo je prázdné. */
export const toForm = (detail) => ({
  race_director: detail.race_director ?? '',
  technical_delegate: detail.technical_delegate ?? '',
  chief_timekeeper: detail.chief_timekeeper ?? '',
  runs: RUN_NUMBERS.map((runNumber) => toFormRun(runNumber, detail.runs.find((run) => run.run_number === runNumber))),
});

const textOrNull = (value) => String(value).trim() || null;
const numberOrNull = (value) => (value === '' ? null : Number(value));

/** Tělo PUT: prázdné texty a čísla jako null. Délka trati je volný text (400 i „400m, 7 stanovišť“). */
export const toPayload = (form) => ({
  race_director: form.race_director.trim() || null,
  technical_delegate: form.technical_delegate.trim() || null,
  chief_timekeeper: form.chief_timekeeper.trim() || null,
  runs: form.runs.map((run) => ({
    run_number: run.run_number,
    course_setter: textOrNull(run.course_setter),
    gates_count: numberOrNull(run.gates_count),
    conditions: textOrNull(run.conditions),
    start_time: textOrNull(run.start_time),
    course_length_m: textOrNull(run.course_length_m),
  })),
});
