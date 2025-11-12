/*
 * Copyright 2024 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { FormFieldBlueprint } from '@backstage/plugin-scaffolder-react/alpha';
import {
  ValidateKebabCase,
  validateKebabCaseValidation,
} from './ValidateKebabCaseExtension';

/**
 * Form field extension for validating kebab-case formatted strings
 *
 * This field validates that user input follows kebab-case conventions:
 * - Only lowercase letters, numbers, hyphens, and underscores
 * - Must start and end with an alphanumeric character
 * - Maximum 253 characters (Kubernetes naming limit)
 *
 * Usage in template YAML:
 * ```yaml
 * properties:
 *   resourceName:
 *     type: string
 *     ui:field: ValidateKebabCase
 *     title: Resource Name
 *     description: Name for your Kubernetes resource
 * ```
 *
 * @public
 */
export const validateKebabCaseFormField = FormFieldBlueprint.make({
  name: 'ValidateKebabCase',
  params: {
    field: () => ({
      component: ValidateKebabCase,
      validation: validateKebabCaseValidation,
    }),
  },
});
