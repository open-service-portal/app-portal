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

import React from 'react';
import {
  createFrontendModule,
  createExtension,
  coreExtensionData,
} from '@backstage/frontend-plugin-api';
import { CustomProviderSettings } from '../components/CustomProviderSettings';

/**
 * Extension that provides custom provider settings to the user-settings plugin.
 *
 * This extension outputs a React element containing our custom provider list
 * that includes the Kubernetes OIDC provider alongside the default Backstage providers.
 */
const customProviderSettingsExtension = createExtension({
  namespace: 'user-settings',
  name: 'custom-provider-settings',
  attachTo: { id: 'page:user-settings', input: 'providerSettings' },
  output: [coreExtensionData.reactElement],
  factory() {
    return [
      coreExtensionData.reactElement(React.createElement(CustomProviderSettings)),
    ];
  },
});

/**
 * Frontend module that extends the user-settings plugin with custom provider settings.
 *
 * This module allows us to add the Kubernetes OIDC authentication provider
 * to the Settings > Authentication Providers page without forking the
 * official user-settings plugin.
 *
 * @public
 */
export const userSettingsModule = createFrontendModule({
  pluginId: 'user-settings',
  extensions: [customProviderSettingsExtension],
});
