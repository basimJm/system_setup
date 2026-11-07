import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MOCK_SETTING_DEFAULTS } from '@/data/mock/settingsFixture';
import SettingsPage from '@/presentation/settings/SettingsPage';
import { makeContainer, renderWithApp } from './helpers/render';

const box = (name: RegExp) => screen.findByRole<HTMLInputElement>('textbox', { name });

async function setup() {
  const container = makeContainer();
  renderWithApp(<SettingsPage />, container);
  await box(/Code length/);
  return container;
}

describe('SettingsPage', () => {
  it('shows the first tab with the effective values and defaults', async () => {
    await setup();
    expect(screen.getByRole('heading', { name: 'Verification code (OTP)' })).toBeInTheDocument();
    expect(await box(/Code length/)).toHaveValue('6');
    expect(await box(/Wait before resending/)).toHaveValue('60');
    expect(screen.getAllByText('Default').length).toBeGreaterThan(3);
  });

  it('validates as you type and blocks saving', async () => {
    await setup();
    const length = await box(/Code length/);
    await userEvent.clear(length);
    expect(await screen.findByText('Enter a value')).toBeInTheDocument();
    await userEvent.type(length, '999');
    expect(screen.getByText('Must be at most 10')).toBeInTheDocument();
    await userEvent.clear(length);
    await userEvent.type(length, '2.5');
    expect(screen.getByText('Whole numbers only')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('saving asks for a reason, sends the changed keys, then shows them as changed', async () => {
    await setup();
    const length = await box(/Code length/);
    await userEvent.clear(length);
    await userEvent.type(length, '8');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Save 1 changed settings')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByRole('textbox'), 'Longer codes for everyone');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('Changed')).toBeInTheDocument();
    expect(await box(/Code length/)).toHaveValue('8');
  });

  it('"Use default" puts the default back in the box', async () => {
    await setup();
    const resend = await box(/Wait before resending/);
    await userEvent.clear(resend);
    await userEvent.type(resend, '90');
    const row = resend.closest('.app-setting') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'Use default' }));
    expect(resend).toHaveValue('60');
  });

  it('security and limits tabs hold the other groups; list and object settings save as one value', async () => {
    await setup();
    await userEvent.click(screen.getByRole('tab', { name: 'Accounts and security' }));
    expect(await box(/Idle sign-out/)).toHaveValue('172800');
    await userEvent.click(screen.getByRole('tab', { name: 'Limits and alerts' }));
    const reminders = await box(/Escalation reminders/);
    expect(reminders).toHaveValue('60, 15');
    await userEvent.clear(reminders);
    await userEvent.type(reminders, '15, 15');
    expect(screen.getByText('Do not repeat a value')).toBeInTheDocument();
    await userEvent.clear(reminders);
    await userEvent.type(reminders, '60, 15');
    const failures = await box(/Failed background jobs that raise an alert/);
    expect(failures).toHaveValue('5');
    expect(screen.getByText(String(MOCK_SETTING_DEFAULTS.timezone))).toBeInTheDocument();
    expect(screen.getByText(String(MOCK_SETTING_DEFAULTS.currency))).toBeInTheDocument();
    await userEvent.clear(failures);
    await userEvent.type(failures, '8');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox'), 'More tolerance');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await box(/Failed background jobs that raise an alert/)).toHaveValue('8');
    // the other member of the object kept its value
    expect(await box(/Window for that count/)).toHaveValue('60');
  });

  it('shows the error state with retry when settings cannot be loaded', async () => {
    const container = makeContainer();
    container.mock?.scenarios.set('serverError');
    renderWithApp(<SettingsPage />, container);
    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
