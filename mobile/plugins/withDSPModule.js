const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

// Android-only plugin for DSP module
// iOS uses the DSP pod via expo-modules-autolinking
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

module.exports = function withDSPModule(config) {
  // Only Android needs the plugin - iOS uses the DSP pod
  config = withDSPModuleAndroid(config);
  return config;
};
