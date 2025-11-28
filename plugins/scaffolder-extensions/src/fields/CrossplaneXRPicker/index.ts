import { createFormField } from '@backstage/plugin-scaffolder-react/alpha';
import {
  CrossplaneXRPicker as Component,
  crossplaneXRPickerValidation,
} from './CrossplaneXRPickerExtension';

export const CrossplaneXRPicker = createFormField({
  component: Component,
  name: 'CrossplaneXRPicker',
  validation: crossplaneXRPickerValidation,
});
