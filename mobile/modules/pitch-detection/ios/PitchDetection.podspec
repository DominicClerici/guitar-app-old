Pod::Spec.new do |s|
  s.name           = 'PitchDetection'
  s.version        = '1.0.0'
  s.summary        = 'Fast pitch detection using autocorrelation'
  s.description    = 'Native pitch detection module using autocorrelation algorithm'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = [
    "**/*.{h,m,mm,swift,hpp,cpp}"
  ]

  s.private_header_files = [
    "**/*.hpp"
  ]

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17'
  }
end
