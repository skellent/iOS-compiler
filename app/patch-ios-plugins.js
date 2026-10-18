import { join } from "node:path";

const pluginDirectory = join(
  import.meta.dir,
  "node_modules",
  "@capacitor-community",
  "background-geolocation",
);
const packagePath = join(pluginDirectory, "package.json");
const swiftPackagePath = join(pluginDirectory, "Package.swift");
const expectedPluginVersion = "1.2.26";

const packageFile = Bun.file(packagePath);
if (!(await packageFile.exists())) {
  throw new Error("Install dependencies before preparing the iOS plugins.");
}

const pluginPackage = await packageFile.json();
if (pluginPackage.version !== expectedPluginVersion) {
  throw new Error(
    `Refusing to patch @capacitor-community/background-geolocation ${pluginPackage.version}; ` +
    `expected ${expectedPluginVersion}. Review the upstream release before updating this guard.`,
  );
}

const swiftPackageFile = Bun.file(swiftPackagePath);
let swiftPackage = await swiftPackageFile.text();
const capacitor7Requirement = 'from: "7.0.0"';
const capacitor8Requirement = 'from: "8.0.0"';

if (swiftPackage.includes(capacitor7Requirement)) {
  swiftPackage = swiftPackage.replace(capacitor7Requirement, capacitor8Requirement);
  await Bun.write(swiftPackagePath, swiftPackage);
} else if (!swiftPackage.includes(capacitor8Requirement)) {
  throw new Error(
    "The background-geolocation Swift package requirement changed unexpectedly. " +
    "Review it before preparing the iOS project.",
  );
}

const capacitorDevelopmentDependencies = [
  "@capacitor/android",
  "@capacitor/core",
  "@capacitor/ios",
];
let packageMetadataChanged = false;

for (const dependency of capacitorDevelopmentDependencies) {
  const requirement = pluginPackage.devDependencies?.[dependency];
  if (requirement === "^7.0.0") {
    pluginPackage.devDependencies[dependency] = "^8.0.0";
    packageMetadataChanged = true;
  } else if (requirement !== "^8.0.0") {
    throw new Error(
      `${dependency} has an unexpected requirement (${requirement}) in the ` +
      "background-geolocation package. Review it before preparing iOS.",
    );
  }
}

if (packageMetadataChanged) {
  await Bun.write(packagePath, `${JSON.stringify(pluginPackage, null, 4)}\n`);
}

console.log(
  `Prepared @capacitor-community/background-geolocation ${expectedPluginVersion} ` +
  "for the Capacitor 8 iOS build experiment.",
);
