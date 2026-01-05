Pod::Spec.new do |s|
  s.name           = 'DSP'
  s.version        = '1.0.0'
  s.summary        = 'DSP module for pitch detection using YIN algorithm'
  s.description    = 'C++ TurboModule for audio signal processing'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'React-Core'
  s.dependency 'React-callinvoker'
  s.dependency 'ReactCommon/turbomodule/core'
  s.dependency 'ReactCodegen'

  s.source_files = [
    "**/*.{h,m,mm,cpp,hpp}"
  ]

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20',
    'OTHER_CPLUSPLUSFLAGS' => '$(inherited) -DFOLLY_NO_CONFIG=1 -DFOLLY_CFG_NO_COROUTINES=1',
    'GCC_PREPROCESSOR_DEFINITIONS' => '$(inherited) FOLLY_NO_CONFIG=1 FOLLY_CFG_NO_COROUTINES=1',
    'HEADER_SEARCH_PATHS' => [
      '"$(PODS_TARGET_SRCROOT)"',
      '"$(PODS_TARGET_SRCROOT)/yin"',
      '"$(PODS_ROOT)/Headers/Public/ReactCodegen"',
      '"$(PODS_ROOT)/Headers/Private/ReactCodegen"',
      '"$(PODS_ROOT)/Headers/Public/React-Core"',
      '"$(PODS_ROOT)/Headers/Private/React-Core"',
      '"$(PODS_ROOT)/boost"',
      '"$(PODS_ROOT)/DoubleConversion"',
      '"$(PODS_ROOT)/fmt/include"',
    ].join(' ')
  }
end
