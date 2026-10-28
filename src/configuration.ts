export interface ConfigurationInspection {
  globalValue?: unknown;
  workspaceValue?: unknown;
  workspaceFolderValue?: unknown;
}

export type WritableConfigurationScope = 'global' | 'workspace' | 'workspaceFolder';

export function writableConfigurationScope(inspection: ConfigurationInspection): WritableConfigurationScope {
  if (inspection.workspaceFolderValue !== undefined) {
    return 'workspaceFolder';
  }
  if (inspection.workspaceValue !== undefined) {
    return 'workspace';
  }
  return 'global';
}
