import { FormFieldBlueprint } from '@backstage/plugin-scaffolder-react/alpha';

/**
 * Custom scaffolder field extension for Entra ID user selection
 *
 * This field provides autocomplete search for Microsoft Entra ID users,
 * returning exact email addresses as stored in Entra ID (preserving case).
 *
 * Usage in template:
 *   ui:field: entra-id-user-picker
 *   ui:options:
 *     domain: openportal.dev
 */

export const EntraIdUserPickerFieldExtension = FormFieldBlueprint.make({
  name: 'entra-id-user-picker',
  attachTo: { id: 'api:scaffolder/form-fields', input: 'formFields' },
  params: {
    field: () => import('./EntraIdUserPicker/EntraIdUserPickerField').then(m => m.EntraIdUserPickerField),
  },
});
