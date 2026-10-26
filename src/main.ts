/** UI wiring. Nothing is persisted and nothing is fetched at runtime. */
import './styles.css';
import {
  calculate,
  type CalcRequest,
  type Distribution,
  type Mode,
  type Region,
} from './calc';

const DEFAULTS = {
  distribution: 'normal' as Distribution,
  mode: 'probability' as Mode,
  region: 'left' as Region,
  value: '1.96',
  probability: '0.05',
  df: '10',
};

const EMPTY_RESULT = 'Choose your options and select Calculate.';

const form = document.getElementById('calculator') as HTMLFormElement;
const resetButton = document.getElementById('reset') as HTMLButtonElement;
const result = document.getElementById('result') as HTMLElement;
const dfField = document.getElementById('df-field') as HTMLElement;
const valueField = document.getElementById('value-field') as HTMLElement;
const probabilityField = document.getElementById('probability-field') as HTMLElement;
const valueLabel = document.getElementById('value-label') as HTMLElement;
const valueHelp = document.getElementById('value-help') as HTMLElement;
const dfInput = document.getElementById('df') as HTMLInputElement;
const valueInput = document.getElementById('value') as HTMLInputElement;
const probabilityInput = document.getElementById('probability') as HTMLInputElement;

const INPUTS = [dfInput, valueInput, probabilityInput];

function selected<T extends string>(name: string): T {
  const el = form.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`);
  return (el ? el.value : '') as T;
}

function currentRequest(): CalcRequest {
  return {
    distribution: selected<Distribution>('distribution'),
    mode: selected<Mode>('mode'),
    region: selected<Region>('region'),
    valueText: valueInput.value,
    probabilityText: probabilityInput.value,
    dfText: dfInput.value,
  };
}

/** Show the inputs the current selection actually uses. Visibility only --
 *  focus is never moved, so switching modes cannot pull focus away. */
function syncVisibility(): void {
  const distribution = selected<Distribution>('distribution');
  const mode = selected<Mode>('mode');
  const region = selected<Region>('region');
  const symmetric = region === 'central' || region === 'twoTails';

  dfField.hidden = distribution !== 't';
  valueField.hidden = mode !== 'probability';
  probabilityField.hidden = mode !== 'value';

  if (symmetric) {
    valueLabel.textContent = 'Cutoff c';
    valueHelp.textContent = 'A number of 0 or more, such as 1.96.';
  } else {
    valueLabel.textContent = 'Value';
    valueHelp.textContent = 'A number such as 1.96 or -2.5.';
  }
}

function clearResult(): void {
  result.textContent = EMPTY_RESULT;
  for (const input of INPUTS) input.removeAttribute('aria-invalid');
}

function render(): void {
  const outcome = calculate(currentRequest());
  for (const input of INPUTS) input.removeAttribute('aria-invalid');
  result.replaceChildren();

  if (!outcome.ok) {
    const problem = document.createElement('span');
    problem.className = 'problem';
    problem.textContent = outcome.message;
    result.append(problem);

    const field =
      outcome.field === 'df'
        ? dfInput
        : outcome.field === 'probability'
          ? probabilityInput
          : valueInput;
    field.setAttribute('aria-invalid', 'true');
    field.focus();
    return;
  }

  const answer = document.createElement('span');
  answer.className = 'answer';
  answer.textContent = outcome.statement;
  result.append(answer);

  for (const line of outcome.detail) {
    const extra = document.createElement('span');
    extra.className = 'detail';
    extra.textContent = line;
    result.append(extra);
  }
}

function applyDefaults(): void {
  for (const [name, value] of [
    ['distribution', DEFAULTS.distribution],
    ['mode', DEFAULTS.mode],
    ['region', DEFAULTS.region],
  ] as const) {
    const el = form.querySelector<HTMLInputElement>(
      `input[name="${name}"][value="${value}"]`,
    );
    if (el) el.checked = true;
  }
  valueInput.value = DEFAULTS.value;
  probabilityInput.value = DEFAULTS.probability;
  dfInput.value = DEFAULTS.df;
  syncVisibility();
  clearResult();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  render();
});

// Any change to a selection or an entry invalidates the answer on screen.
form.addEventListener('change', (event) => {
  if ((event.target as HTMLElement).matches('input[type="radio"]')) {
    syncVisibility();
  }
  clearResult();
});

form.addEventListener('input', clearResult);

resetButton.addEventListener('click', () => {
  applyDefaults();
});

syncVisibility();
clearResult();
