import type { PiRuntime } from "../../integrations/pi/pi-runtime.js";

export type PiAdminService = {
  packages(): Promise<string>;
  resources(): Promise<string>;
  install(source: string): Promise<string>;
  remove(source: string): Promise<string>;
  reload(): Promise<string>;
};

export const createPiAdminService = (runtime: PiRuntime): PiAdminService => ({
  packages: () => runtime.listPackages(),
  resources: () => runtime.listResources(),
  install: (source) => runtime.installPackage(source),
  remove: (source) => runtime.removePackage(source),
  reload: () => runtime.reloadResources(),
});
