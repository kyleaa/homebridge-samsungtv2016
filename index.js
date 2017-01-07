var WebSocket = require('ws');
var wol = require('wake_on_lan');
var inherits = require('util').inherits;
var Service, Characteristic;
var request = require('request');

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory("homebridge-samsungtv", "SamsungTV2016", SamsungTv2016Accessory);
};

//
// SamsungTV2016 Accessory
//

function SamsungTv2016Accessory(log, config) {
    var accessory = this;
    this.log = log;
    this.config = config;
    this.name = config["name"];
    this.mac_address = config["mac_address"];
    this.ip_address = config["ip_address"];
    this.api_timeout = config["api_timeout"] || 2000;

    if (!this.ip_address) throw new Error("You must provide a config value for 'ip_address'.");
    if (!this.mac_address) throw new Error("You must provide a config value for 'mac_address'.");
    this.app_name_base64 = (new Buffer(config["app_name"] || "homebridge")).toString('base64');

    this.is_powering_off = false;

    this.wake = function(done) {
      wol.wake(this.mac_address, function(error) {
        if (error) { done(1); }
        else { done(0); }
      });
    };

    this.sendKey = function(key, done) {
      var ws = new WebSocket('http://' + this.ip_address + ':8001/api/v2/channels/samsung.remote.control?name=' + this.app_name_base64);
      ws.on('message', function(data, flags) {
        var cmd =  {"method":"ms.remote.control","params":{"Cmd":"Click","DataOfCmd":key,"Option":"false","TypeOfRemote":"SendRemoteKey"}};
        data = JSON.parse(data);
        if(data.event == "ms.channel.connect") {
          accessory.log('websocket connect');
          ws.send(JSON.stringify(cmd));
          setTimeout(function() {ws.close(); accessory.log('websocket closed');}, 1000);
          done(0);
        }
      });
    };

    this.service = new Service.Switch(this.name);

    this.is_api_active = function(done) {
      request.get({ url: 'http://' + this.ip_address + ':8001/api/v2/', timeout: this.api_timeout}, function(err, res, body) {
        if(!err && res.statusCode === 200) {
          accessory.log('TV API is active');
          done(true);
        } else {
          accessory.log('No response from TV');
          done(false);
        }
      });
    };

    this.service
        .getCharacteristic(Characteristic.On)
        .on('get', this._getOn.bind(this))
        .on('set', this._setOn.bind(this));
}

SamsungTv2016Accessory.prototype.getInformationService = function() {
    var informationService = new Service.AccessoryInformation();
    informationService
        .setCharacteristic(Characteristic.Name, this.name)
        .setCharacteristic(Characteristic.Manufacturer, 'Samsung TV')
        .setCharacteristic(Characteristic.Model, '1.0.0')
        .setCharacteristic(Characteristic.SerialNumber, this.ip_address);
    return informationService;
};

SamsungTv2016Accessory.prototype.getServices = function() {
    return [this.service, this.getInformationService()];
};



SamsungTv2016Accessory.prototype._getOn = function(callback) {
    var accessory = this;

    if(accessory.is_powering_off) {
      accessory.log('power off in progress, reporting status as off.');
      callback(null, false);
    } else {
      // if we can access the info API, then assume the TV is on
      // there is a short period of time after the TV is turned off where the API is still active
      // so this isn't bulletproof.
      this.is_api_active(function(active) {
        callback(null, active);
      });
    }
};

SamsungTv2016Accessory.prototype._setOn = function(on, callback) {
    var accessory = this;
    accessory.log('received on command: ' + on);

    if (on) {
      accessory.is_api_active(function(alive) {
        if(alive) {
          accessory.log('sending power key');
          accessory.sendKey('KEY_POWER', function(err) {
              if (err) {
                  callback(new Error(err));
              } else {
                  // command has been successfully transmitted to your tv
                  accessory.log('successfully powered on tv');
                  accessory.is_powering_off = false;
                  callback(null);
              }
          });
        } else {
          accessory.log('attempting wake');
          accessory.wake(function(err) {
              if (err) {
                  callback(new Error(err));
              } else {
                  // command has been successfully transmitted to your tv
                  accessory.log('successfully woke tv');
                  callback(null);
              }
          });
        }
      });
    } else {
        accessory.log('sending power key');
        accessory.sendKey('KEY_POWER', function(err) {
            if (err) {
                callback(new Error(err));
            } else {
                // command has been successfully transmitted to your tv
                accessory.log('successfully powered off tv');
                accessory.is_powering_off = true;
                setTimeout(function() { accessory.is_powering_off = false;}, 15000)
                callback(null);
            }
        });
    }
};
