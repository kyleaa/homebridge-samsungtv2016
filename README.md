#Homebridge-samsungtv2016

Samsung TV plugin for [Homebridge](https://github.com/nfarina/homebridge)

This allows you to control your 2016 Samsung TV with HomeKit and Siri.

##Installation
1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: npm install -g homebridge-samsungtv2016
3. Update your configuration file. See `config-sample.json`.

##Important Notes
The TV API does not work when the TV is powered down, but it will respond to a wake-on-lan command over ethernet. I did not test this over wifi, but I would not expect it to work.
