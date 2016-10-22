var WebSocket = require('ws');
var wol = require('wake_on_lan');
var inherits = require('util').inherits;
var Service, Characteristic;

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory("homebridge-samsungtv", "SamsungTV2016", SamsungTv2016Accessory);
};

//
// SamsungTV2016 Accessory
//

function SamsungTv2016Accessory(log, config) {
    this.log = log;
    this.config = config;
    this.name = config["name"];
    this.mac_address = config["mac_address"];
    this.ip_address = config["ip_address"];

    // assume the TV is off at startup
    this.is_on = false;

    if (!this.ip_address) throw new Error("You must provide a config value for 'ip_address'.");
    if (!this.mac_address) throw new Error("You must provide a config value for 'mac_address'.");
    this.app_name_base64 = new Buffer(config["app_name"] || "homebridge").toString('base64');

    // this.remote = new SamsungRemote({
    //     ip: this.ip_address // required: IP address of your Samsung Smart TV
    // });

    this.wake = function(done) {
      wol.wake(this.mac_address, function(error) {
        if (error) { done(1); }
        else { done(0); }
      });
    };

    this.sendKey = function(key, done) {
      var ws = new WebSocket('http://' + this.ip_address + ':8001/api/v2/channels/samsung.remote.control?name=' + this.app_name);
      ws.on('message', function(data, flags) {
        var cmd =  {"method":"ms.remote.control","params":{"Cmd":"Click","DataOfCmd":key,"Option":"false","TypeOfRemote":"SendRemoteKey"}};
        data = JSON.parse(data);
        if(data.event == "ms.channel.connect") {
          ws.send(JSON.stringify(cmd));
          ws.close();
          done(0);
        }
      });
    };

    this.service = new Service.Switch(this.name);

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
    callback(null, this.is_on);
};

SamsungTv2016Accessory.prototype._setOn = function(on, callback) {
    var accessory = this;
    accessory.log.debug('received on command: ' + on);

    if (on) {
        accessory.log.debug('attempting wake');
        this.wake(function(err) {
            if (err) {
                callback(new Error(err));
            } else {
                // command has been successfully transmitted to your tv
                accessory.log.debug('successfully woke tv');
                this.is_on = true;
                callback(null);
            }
        });
    } else {
        accessory.log.debug('sending power key');
        this.sendKey('KEY_POWER', function(err) {
            if (err) {
                callback(new Error(err));
            } else {
                // command has been successfully transmitted to your tv
                accessory.log.debug('successfully powered off tv');
                this.is_on = false;
                callback(null);
            }
        });
    }
};
