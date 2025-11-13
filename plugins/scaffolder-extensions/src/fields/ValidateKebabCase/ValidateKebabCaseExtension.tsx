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

import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import type { FieldValidation } from '@rjsf/utils';
import FormControl from '@material-ui/core/FormControl';
import FormHelperText from '@material-ui/core/FormHelperText';
import Input from '@material-ui/core/Input';
import InputLabel from '@material-ui/core/InputLabel';

/**
 * ValidateKebabCase component for validating kebab-case strings
 *
 * Validates that input contains only:
 * - lowercase letters (a-z)
 * - numbers (0-9)
 * - hyphens (-)
 * - underscores (_)
 *
 * This is the standard format for Kubernetes resource names and identifiers.
 *
 * @example
 * Valid: "my-app", "app-v2", "test_service"
 * Invalid: "MyApp", "app.service", "app name"
 *
 * @public
 */
export const ValidateKebabCase = ({
  onChange,
  rawErrors,
  required,
  formData,
  schema,
}: FieldExtensionComponentProps<string>) => {
  const hasError = rawErrors && rawErrors.length > 0;
  const label = schema.title || 'Name';
  const description = schema.description ||
    'Use only lowercase letters, numbers, hyphens and underscores';

  return (
    <FormControl
      margin="normal"
      required={required}
      error={hasError}
      fullWidth
    >
      <InputLabel htmlFor="validateKebabCase">{label}</InputLabel>
      <Input
        id="validateKebabCase"
        value={formData || ''}
        onChange={e => onChange(e.target.value)}
        aria-describedby="kebabCaseHelper"
        placeholder="my-resource-name"
      />
      <FormHelperText id="kebabCaseHelper" error={hasError}>
        {hasError ? rawErrors.join(', ') : description}
      </FormHelperText>
    </FormControl>
  );
};

/**
 * Validation function for kebab-case format
 *
 * Validates according to Kubernetes naming conventions:
 * - Must contain only lowercase alphanumeric characters, '-' or '_'
 * - Must start and end with an alphanumeric character
 * - Maximum length: 253 characters (Kubernetes limit)
 *
 * @param value - The value to validate
 * @param validation - The validation object to add errors to
 *
 * @public
 */
export const validateKebabCaseValidation = (
  value: string,
  validation: FieldValidation,
): void => {
  if (!value) {
    return; // Let required field validation handle empty values
  }

  // Basic kebab-case pattern: starts and ends with alphanumeric, allows hyphens and underscores in between
  const kebabCasePattern = /^[a-z0-9]([a-z0-9-_]*[a-z0-9])?$/;

  if (!kebabCasePattern.test(value)) {
    validation.addError(
      'Must contain only lowercase letters, numbers, hyphens ("-") and underscores ("_"). ' +
      'Must start and end with a letter or number.'
    );
    return;
  }

  // Check length (Kubernetes resource name limit)
  if (value.length > 253) {
    validation.addError(
      `Name must be 253 characters or less (currently ${value.length} characters)`
    );
    return;
  }

  // Optional: Warn about consecutive hyphens/underscores (not invalid, but not recommended)
  if (/[-_]{2,}/.test(value)) {
    validation.addError(
      'Avoid consecutive hyphens or underscores for better readability'
    );
  }
};
