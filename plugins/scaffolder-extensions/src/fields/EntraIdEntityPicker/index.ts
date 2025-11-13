import { createFormField } from '@backstage/plugin-scaffolder-react/alpha';
import {
  EntraIdEntityPicker as Component,
  entraIdEntityPickerValidation,
} from './EntraIdEntityPickerExtension';

export const EntraIdEntityPicker = createFormField({
  component: Component,
  name: 'EntraIdEntityPicker',
  validation: entraIdEntityPickerValidation,
});
