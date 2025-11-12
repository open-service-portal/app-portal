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

/**
 * Custom Scaffolder Field Extensions Package
 *
 * This package provides custom field extensions for the Backstage Scaffolder plugin.
 *
 * @packageDocumentation
 */

// Export all custom field extensions
export { ValidateKebabCase } from './fields/ValidateKebabCase';
export { validateKebabCaseValidation } from './fields/ValidateKebabCase/ValidateKebabCaseExtension';
export { EntraIdEntityPicker } from './fields/EntraIdEntityPicker';
export { entraIdEntityPickerValidation } from './fields/EntraIdEntityPicker/EntraIdEntityPickerExtension';
