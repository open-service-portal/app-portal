import { createFormField } from '@backstage/plugin-scaffolder-react/alpha';
import { EntraIdUserPicker } from './EntraIdUserPicker';

/**
 * Form field wrapper for Entra ID user picker
 *
 * This wraps the EntraIdUserPicker component in the createFormField helper
 * to make it compatible with the New Frontend System's FormFieldBlueprint.
 */
export const EntraIdUserPickerField = createFormField({
  component: EntraIdUserPicker,
  name: 'EntraIdUserPicker',  // This name should match the ui:field value in templates
});
