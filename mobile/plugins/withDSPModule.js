const {
  withDangerousMod,
  withXcodeProject,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withDSPModuleAndroid(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidPath = path.join(projectRoot, "android");
      const jniPath = path.join(androidPath, "app", "src", "main", "jni");

      // Ensure jni directory exists
      if (!fs.existsSync(jniPath)) {
        fs.mkdirSync(jniPath, { recursive: true });
      }

      // Create CMakeLists.txt
      const cmakeContent = `cmake_minimum_required(VERSION 3.13)
set(CMAKE_VERBOSE_MAKEFILE on)

project(appmodules)

# This file includes all the necessary to let you build your React Native application
include(\${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

# Define where the additional source code lives
set(DSP_DIR "\${CMAKE_SOURCE_DIR}/../../../../../modules/dsp/shared")

target_sources(\${CMAKE_PROJECT_NAME} PRIVATE
    \${DSP_DIR}/NativeDSPModule.cpp
    \${DSP_DIR}/yin/yin.cpp
    \${DSP_DIR}/util.cpp
)

# Define where CMake can find the additional header files
target_include_directories(\${CMAKE_PROJECT_NAME} PUBLIC
    \${DSP_DIR}
    \${DSP_DIR}/yin
)
`;

      fs.writeFileSync(path.join(jniPath, "CMakeLists.txt"), cmakeContent);

      // Create OnLoad.cpp
      const onLoadContent = `#include <DefaultComponentsRegistry.h>
#include <DefaultTurboModuleManagerDelegate.h>
#include <autolinking.h>
#include <fbjni/fbjni.h>
#include <react/renderer/componentregistry/ComponentDescriptorProviderRegistry.h>
#include <rncore.h>
#include <NativeDSPModule.h>

#ifdef REACT_NATIVE_APP_CODEGEN_HEADER
#include REACT_NATIVE_APP_CODEGEN_HEADER
#endif
#ifdef REACT_NATIVE_APP_COMPONENT_DESCRIPTORS_HEADER
#include REACT_NATIVE_APP_COMPONENT_DESCRIPTORS_HEADER
#endif

namespace facebook::react {

void registerComponents(
    std::shared_ptr<const ComponentDescriptorProviderRegistry> registry) {
#ifdef REACT_NATIVE_APP_COMPONENT_REGISTRATION
  REACT_NATIVE_APP_COMPONENT_REGISTRATION(registry);
#endif
  autolinking_registerProviders(registry);
}

std::shared_ptr<TurboModule> cxxModuleProvider(
    const std::string& name,
    const std::shared_ptr<CallInvoker>& jsInvoker) {
  if (name == NativeDSPModule::kModuleName) {
    return std::make_shared<NativeDSPModule>(jsInvoker);
  }
  return autolinking_cxxModuleProvider(name, jsInvoker);
}

std::shared_ptr<TurboModule> javaModuleProvider(
    const std::string& name,
    const JavaTurboModule::InitParams& params) {
#ifdef REACT_NATIVE_APP_MODULE_PROVIDER
  auto module = REACT_NATIVE_APP_MODULE_PROVIDER(name, params);
  if (module != nullptr) {
    return module;
  }
#endif
  if (auto module = rncore_ModuleProvider(name, params)) {
    return module;
  }
  if (auto module = autolinking_ModuleProvider(name, params)) {
    return module;
  }
  return nullptr;
}

} // namespace facebook::react

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return facebook::jni::initialize(vm, [] {
    facebook::react::DefaultTurboModuleManagerDelegate::cxxModuleProvider =
        &facebook::react::cxxModuleProvider;
    facebook::react::DefaultTurboModuleManagerDelegate::javaModuleProvider =
        &facebook::react::javaModuleProvider;
    facebook::react::DefaultComponentsRegistry::
        registerComponentDescriptorsFromEntryPoint =
            &facebook::react::registerComponents;
  });
}
`;

      fs.writeFileSync(path.join(jniPath, "OnLoad.cpp"), onLoadContent);

      return config;
    },
  ]);
}

function withDSPModuleiOS(config) {
  return withXcodeProject(config, async (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const iosPath = path.join(projectRoot, "ios");
    const projectName = config.modRequest.projectName;
    const project = config.modResults;

    // Paths to DSP source files (relative to iOS project)
    const dspSourceDir = "../modules/dsp/shared";
    const sourceFiles = [
      `${dspSourceDir}/NativeDSPModule.cpp`,
      `${dspSourceDir}/util.cpp`,
      `${dspSourceDir}/yin/yin.cpp`,
    ];

    // Get the main group
    const mainGroupKey = project.getFirstProject().firstProject.mainGroup;

    // Find or create DSP group
    let dspGroupKey = null;
    const groups = project.hash.project.objects["PBXGroup"];
    for (const key in groups) {
      if (groups[key].name === "DSP") {
        dspGroupKey = key;
        break;
      }
    }

    if (!dspGroupKey) {
      dspGroupKey = project.pbxCreateGroup("DSP", "../modules/dsp/shared");
      project.addToPbxGroup(dspGroupKey, mainGroupKey);
    }

    // Add source files to project
    for (const sourceFile of sourceFiles) {
      const fileName = path.basename(sourceFile);
      project.addSourceFile(
        sourceFile,
        { target: project.getFirstTarget().uuid },
        dspGroupKey
      );
    }

    // Add header search paths
    const buildConfigurations = project.pbxXCBuildConfigurationSection();
    for (const key in buildConfigurations) {
      const buildConfig = buildConfigurations[key];
      if (typeof buildConfig === "object" && buildConfig.buildSettings) {
        const headerSearchPaths =
          buildConfig.buildSettings.HEADER_SEARCH_PATHS || [];
        const newPaths = [
          '"$(SRCROOT)/../modules/dsp/shared"',
          '"$(SRCROOT)/../modules/dsp/shared/yin"',
        ];

        if (Array.isArray(headerSearchPaths)) {
          for (const newPath of newPaths) {
            if (!headerSearchPaths.includes(newPath)) {
              headerSearchPaths.push(newPath);
            }
          }
        } else {
          buildConfig.buildSettings.HEADER_SEARCH_PATHS = [
            headerSearchPaths,
            ...newPaths,
          ];
        }

        buildConfig.buildSettings.HEADER_SEARCH_PATHS = headerSearchPaths;
      }
    }

    return config;
  });
}

module.exports = function withDSPModule(config) {
  config = withDSPModuleAndroid(config);
  config = withDSPModuleiOS(config);
  return config;
};
