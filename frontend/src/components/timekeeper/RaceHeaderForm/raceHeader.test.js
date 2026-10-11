import { describe, expect, it } from 'vitest';
import { toForm, toPayload } from './raceHeader.js';

const detail = {
  race_director: 'Ing. Tomáš Malík',
  technical_delegate: null,
  chief_timekeeper: '',
  runs: [{ run_number: 1, course_setter: 'Martin Bureš', gates_count: 18, conditions: null, start_time: '9:00', course_length_m: 320 }],
};

describe('hlavička závodu', () => {
  it('formulář má obě kola, chybějící prázdné', () => {
    const form = toForm(detail);
    expect(form.technical_delegate).toBe('');
    expect(form.runs).toHaveLength(2);
    expect(form.runs[0]).toMatchObject({ course_setter: 'Martin Bureš', gates_count: 18, conditions: '' });
    expect(form.runs[1]).toEqual({ run_number: 2, course_setter: '', gates_count: '', conditions: '', start_time: '', course_length_m: '' });
  });

  it('tělo PUT: prázdné hodnoty jako null, čísla jako čísla', () => {
    const form = toForm(detail);
    form.runs[1].gates_count = '20';
    form.race_director = '  ';
    const payload = toPayload(form);
    expect(payload.race_director).toBeNull();
    expect(payload.runs[0]).toEqual({
      run_number: 1, course_setter: 'Martin Bureš', gates_count: 18, conditions: null, start_time: '9:00', course_length_m: 320,
    });
    expect(payload.runs[1]).toMatchObject({ gates_count: 20, course_setter: null, course_length_m: null });
  });
});
