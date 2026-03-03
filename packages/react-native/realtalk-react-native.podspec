require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name         = "realtalk-react-native"
  s.version      = package['version']
  s.summary      = "Native voice processing module for Real Talk React Native"
  s.homepage     = "https://github.com/realtalk-ai/js-sdk"
  s.license      = package['license']
  s.author       = "Real Talk AI AB"
  s.platform     = :ios, "15.0"
  s.source       = { :git => "https://github.com/realtalk-ai/js-sdk.git", :tag => s.version }
  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.swift_version = "5.0"
  s.frameworks   = "AVFoundation"

  s.dependency "React-Core"
end
