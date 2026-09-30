export type PluginContext = {
  siteId: string;
  locale: string;
};

export type HomepageContribution = {
  id: string;
  title: string;
  description?: string;
  href?: string;
};

export type NoviqPlugin = {
  id: string;
  name: string;
  version: string;
  homepageContributions?: (context: PluginContext) => HomepageContribution[];
};

const registeredPlugins = new Map<string, NoviqPlugin>();

export function registerPlugin(plugin: NoviqPlugin) {
  if (registeredPlugins.has(plugin.id)) {
    throw new Error(`Plugin already registered: ${plugin.id}`);
  }
  registeredPlugins.set(plugin.id, Object.freeze({ ...plugin }));
}

export function listPlugins() {
  return Array.from(registeredPlugins.values());
}

export function clearPluginRegistryForTests() {
  registeredPlugins.clear();
}

export function collectHomepageContributions(context: PluginContext): HomepageContribution[] {
  return listPlugins().flatMap((plugin) => plugin.homepageContributions?.(context) ?? []);
}
