import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useZodForm } from '../../hooks/useZodForm';
import { Card } from '../../components/core/Card';
import { Heading } from '../../components/core/Heading';
import { Text } from '../../components/core/Text';
import { Combobox } from '../../components/form/Combobox';
import { DateField } from '../../components/form/DateField';
import { FormActions } from '../../components/form/FormActions';
import { MoneyField } from '../../components/form/MoneyField';
import { MultiSelect } from '../../components/form/MultiSelect';
import { NumberField } from '../../components/form/NumberField';
import { SearchField } from '../../components/form/SearchField';
import { TextField } from '../../components/form/TextField';
import { GALLERY_UPDATED_AT } from '@/constants/ui';
import { VALIDATION_KEYS, endAfterStart, localDateString, moneyAmount, requiredText } from '@/domain/shared/validation';
import { errorText, messageOf } from '../../utils/formErrors';

const OPTION_KEYS = ['northville', 'eastford', 'southport', 'westbury'] as const;

const schema = endAfterStart(
  z.object({
    name: requiredText(3),
    price: moneyAmount({ positive: true }),
    seats: z.number().int().min(1, VALIDATION_KEYS.required).nullable().refine((v) => v !== null, VALIDATION_KEYS.required),
    city: z.string().min(1, VALIDATION_KEYS.required),
    tags: z.array(z.string()),
    start: localDateString(),
    end: localDateString(),
  }),
  'start',
  'end',
);

/** Gallery section for the form kit (ADM-013); also the reference usage of `useZodForm`. */
export function FormsSection() {
  const { t } = useTranslation();
  const k = (key: string) => t(`design.forms.${key}`);
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState(false);
  const options = OPTION_KEYS.map((key) => ({ value: key, label: k(`option.${key}`) }));
  const form = useZodForm(schema, { name: '', price: '', seats: null, city: '', tags: [], start: '', end: '' });
  const { control, register, handleSubmit, reset, formState } = form;
  const err = (name: keyof z.input<typeof schema>) => errorText(t, messageOf(formState.errors[name]));
  return (
    <Card className="app-stack" aria-label={k('title')}>
      <Heading level={2}>{k('title')}</Heading>
      <SearchField label={k('search')} onSearch={setQuery} />
      <Text tone="muted">{query === '' ? k('searchIdle') : t('design.forms.searchFor', { query })}</Text>
      <form
        className="app-stack"
        noValidate
        onSubmit={(event) => {
          void handleSubmit(() => setSaved(true))(event);
        }}
      >
        <div className="app-grid">
          <TextField label={k('name')} error={err('name')} {...register('name')} />
          <Controller control={control} name="price" render={({ field }) => (
            <MoneyField label={k('price')} currencyLabel={k('currency')} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} error={err('price')} />
          )} />
          <Controller control={control} name="seats" render={({ field }) => (
            <NumberField label={k('seats')} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} error={err('seats')} />
          )} />
          <Controller control={control} name="city" render={({ field }) => (
            <Combobox label={k('city')} options={options} value={field.value === '' ? null : field.value} onValueChange={(v) => field.onChange(v ?? '')} onBlur={field.onBlur} error={err('city')} />
          )} />
          <Controller control={control} name="tags" render={({ field }) => (
            <MultiSelect label={k('tags')} options={options} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} />
          )} />
          <Controller control={control} name="start" render={({ field }) => (
            <DateField label={k('start')} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} error={err('start')} />
          )} />
          <Controller control={control} name="end" render={({ field }) => (
            <DateField label={k('end')} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} error={err('end')} />
          )} />
        </div>
        <FormActions
          dirty={formState.isDirty}
          submitting={formState.isSubmitting}
          lastUpdated={{ by: k('updatedBy'), at: GALLERY_UPDATED_AT }}
          onCancel={() => {
            reset();
            setSaved(false);
          }}
        />
        {saved ? <Text tone="success">{k('saved')}</Text> : null}
      </form>
    </Card>
  );
}
