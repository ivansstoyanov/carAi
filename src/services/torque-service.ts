/*
L293D
Ref: http://www.robotplatform.com/howto/L293/motor_driver_1.html
Truth table
Input                   Function
PWM     IN1     IN2    
H       H       L       Reverse
H       L       H       Forward
H       H       H       Stop
H       L       L       Stop
L       X       X       Stop
*/

class TorqueService {
    // Pin number assignment for L293D
    private PWMA_PIN_NUM: number = 24;
    private AIN1_PIN_NUM: number = 23;
    private AIN2_PIN_NUM: number = 18;

    private PWMB_PIN_NUM: number = 22;
    private BIN1_PIN_NUM: number = 27;
    private BIN2_PIN_NUM: number = 17;


    private PWMA_PIN: any = {};
    private AIN1_PIN: any = {};
    private AIN2_PIN: any = {};
    private PWMB_PIN: any = {};
    private BIN1_PIN: any = {};
    private BIN2_PIN: any = {};

    private PI = false;
    constructor() {
        if (this.PI == true) {
            const Gpio = require('pigpio').Gpio;

            this.PWMA_PIN = new Gpio(this.PWMA_PIN_NUM, { mode: Gpio.OUTPUT });
            this.AIN1_PIN = new Gpio(this.AIN1_PIN_NUM, { mode: Gpio.OUTPUT });
            this.AIN2_PIN = new Gpio(this.AIN2_PIN_NUM, { mode: Gpio.OUTPUT });

            this.PWMB_PIN = new Gpio(this.PWMB_PIN_NUM, { mode: Gpio.OUTPUT });
            this.BIN1_PIN = new Gpio(this.BIN1_PIN_NUM, { mode: Gpio.OUTPUT });
            this.BIN2_PIN = new Gpio(this.BIN2_PIN_NUM, { mode: Gpio.OUTPUT });
        }

        this.PWMA_PIN.digitalWrite && this.PWMA_PIN.digitalWrite(0);
        this.PWMB_PIN.digitalWrite && this.PWMB_PIN.digitalWrite(0);
        this.AIN1_PIN.digitalWrite && this.AIN1_PIN.digitalWrite(0);
        this.AIN2_PIN.digitalWrite && this.AIN2_PIN.digitalWrite(0);
        this.BIN1_PIN.digitalWrite && this.BIN1_PIN.digitalWrite(0);
        this.BIN2_PIN.digitalWrite && this.BIN2_PIN.digitalWrite(0);
    }

    public forword(spinRate: number) {
        this.PWMA_PIN.digitalWrite && this.PWMA_PIN.digitalWrite(1);
        this.PWMA_PIN.digitalWrite && this.PWMA_PIN.pwmWrite(spinRate);
        this.AIN1_PIN.digitalWrite && this.AIN1_PIN.digitalWrite(1);
        this.AIN2_PIN.digitalWrite && this.AIN2_PIN.digitalWrite(0);
    }
    
    public backword(spinRate: number) {
        this.PWMA_PIN.digitalWrite && this.PWMA_PIN.digitalWrite(1);
        this.PWMA_PIN.digitalWrite && this.PWMA_PIN.pwmWrite(spinRate);
        this.AIN1_PIN.digitalWrite && this.AIN1_PIN.digitalWrite(0);
        this.AIN2_PIN.digitalWrite && this.AIN2_PIN.digitalWrite(1);
    }

    public stopTurn() {
        // ==== B ====
        this.PWMB_PIN.digitalWrite && this.PWMB_PIN.digitalWrite(1);
        this.BIN1_PIN.digitalWrite && this.BIN1_PIN.digitalWrite(0);
        this.BIN2_PIN.digitalWrite && this.BIN2_PIN.digitalWrite(0);
    }
    
    public turnleft() {
        // ==== B ====
        this.PWMB_PIN.digitalWrite && this.PWMB_PIN.digitalWrite(1);
        this.BIN1_PIN.digitalWrite && this.BIN1_PIN.digitalWrite(1);
        this.BIN2_PIN.digitalWrite && this.BIN2_PIN.digitalWrite(0);
    }
    
    public turnright() {
        // ==== B ====
        this.PWMB_PIN.digitalWrite && this.PWMB_PIN.digitalWrite(1);
        this.BIN1_PIN.digitalWrite && this.BIN1_PIN.digitalWrite(0);
        this.BIN2_PIN.digitalWrite && this.BIN2_PIN.digitalWrite(1);
    }
}

export default new TorqueService()
