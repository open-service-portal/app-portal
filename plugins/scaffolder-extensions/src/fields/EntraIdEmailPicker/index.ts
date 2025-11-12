import { createFormField } from '@backstage/plugin-scaffolder-react/alpha';
import {
  EntraIdEmailPicker as Component,
  entraIdEmailPickerValidation,
} from './EntraIdEmailPickerExtension';

export const EntraIdEmailPicker = createFormField({
  component: Component,
  name: 'EntraIdEmailPicker',
  validation: entraIdEmailPickerValidation,
});
