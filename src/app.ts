import express from 'express'
import { createServer, Server } from 'http'
// import { createServer, Server } from 'https'
const fs = require('fs');
import compression from 'compression' // compresses requests
import bodyParser from 'body-parser'
import lusca from 'lusca'
import cors from 'cors'
import socket from 'socket.io'

import { registerApiRoutes } from './api/routes/api-router'
import APIErrorHandler from './api/middleware/global-error-handler'
import TorqueService from './services/torque-service'

const PI = false;
const SPEED_PIN = 4;
const DISTANCE_TRIGGER_PIN = 8;
const DISTANCE_ECHO_PIN = 25;

const SPIN_DOORS_PIN = 26;
const LISTEN_STOP_SPIN = 19;
const ALWAYS_ON_SPIN_CHECK = 13;

export class WatcherServer {
    public static readonly PORT: number = 80
    private app: express.Application
    private server: Server
    private io: SocketIO.Server
    private port: string | number

    private distanceCM: any = 100;

    public constructor () {
        this.createApp()
        this.config()
        this.createServer()
        this.registerRoutes()
        this.errorHandling()
        this.sockets()
        this.listen()
        this.serveFrontend()

        // TODO start torque listener here
    }

    private createApp (): void {
        this.app = express()
    }

    private config (): void {
        this.port = process.env.PORT
        this.app.use(cors())
        this.app.use(compression())
        this.app.use(bodyParser.json())
        this.app.use(bodyParser.urlencoded({ extended: true }))
        this.app.use(lusca.xframe('SAMEORIGIN'))
        this.app.use(lusca.xssProtection(true))
    }

    private createServer (): void {
        // const options = {
        //     key: fs.readFileSync('server.key'),
        //     cert: fs.readFileSync('server.cert')
        // };

        // this.server = createServer(options, this.app)

        this.server = createServer(this.app)
    }

    private registerRoutes (): void {
        registerApiRoutes('/api', this.app)
    }

    private serveFrontend (): void {
        this.app.use(express.static(`${__dirname}/web-app`))
        this.app.use('*', (req, res) => res.sendFile(`${__dirname}/web-app/index.html`))
    }

    private errorHandling (): void {
        const apiErrorHandler = new APIErrorHandler(this.app)
        this.app = apiErrorHandler.handleErrors()
    }

    private sockets (): void {
        this.io = socket(this.server, { origins: '*:*' })
    }

    private listen (): void {
        this.server.listen(this.port, async () => {
            console.log('  App is running at http://localhost:%d in %s mode', this.port, process.env.NODE_ENV)
            console.log('  Press CTRL-C to stop\n')
        })

        const SOCKET_ROOM = 'pool'
        let counter = 0
        this.io.on('connection', (socket: any) => {
            socket.join(SOCKET_ROOM)

            counter += 1
            console.log('users', counter)

            socket.on('disconnect', () => {
                socket.leave(SOCKET_ROOM)
                counter -= 1
            })
        })

        const defaultMovement = {
            device: '',
            torque: 0,
            turn: 'none'
        }
        this.io.on('new-navigation', (data: any) => {
            if (defaultMovement.turn != data.turn) {
                defaultMovement.turn = data.turn;
                if (data.turn = 'none') {
                    TorqueService.stopTurn();
                } else if (data.turn = 'left') {
                    TorqueService.turnleft();
                } else if (data.turn = 'right') {
                    TorqueService.turnright();
                }
            }

            if (defaultMovement.torque != data.torque) {
                defaultMovement.torque = data.torque;
                if (data.torque == 0) {
                    TorqueService.backword(0);
                }
                else if (data.torque <= 0) {
                    const current = Math.pow(-data.torque, 2);
                    const squarePercent = current == 0 ? 0 : 100 * (current - 0) / (10000 - 0);
                    const motorPercent = 70 + ((squarePercent * 185) / 100);
                    TorqueService.backword(+motorPercent.toFixed(0));
                } else if (data.torque > 0) {
                    if (this.distanceCM > 20) { // TODO add option to change this
                        const current = Math.pow(data.torque, 2);
                        const squarePercent = 100 * (current - 0) / (10000 - 0);
                        const motorPercent = 70 + ((squarePercent * 185) / 100);
                        TorqueService.forword(+motorPercent.toFixed(0));
                    }
                }
            }
        })


        // Settings & next user queue experience
        // setInterval(() => {
        //    this.io.emit('settings', {data:1})
        // }, 100);

        if (PI) {
            this.configureSpeedEmit();
            this.configureDistance();
        } else {
            setInterval(() => {
                const r = 0.01 // 1cm
                const min = 0;
                const max = 20;
                const rps = Math.floor(Math.random() * (max - min + 1) + min);
                const rpm = rps * 60
                const av = rps * 2 * Math.PI
                const ms = av * r
                const kmh = ms * 3.6
    
                this.io.emit('speed', {
                    rps,
                    rpm,
                    ms,
                    kmh
                })
            }, 100)

            setInterval(() => {
                const rand = Math.floor(Math.random() * (400 - 1 + 1) + 1);
                this.io.emit('distance', {
                    cm: rand
                })
            }, 500)
        }
    }

    private configureSpeedEmit() {
        const Gpio = require('pigpio').Gpio;
 
        const button = new Gpio(SPEED_PIN, {
            mode: Gpio.INPUT,
            pullUpDown: Gpio.PUD_UP,
            alert: true
        });

        let lastSecondEvents: any = [];
        setInterval(() => {
            lastSecondEvents = lastSecondEvents.filter((e: any) => 
                new Date().setSeconds(new Date().getSeconds() - 1) < e)
        }, 2000);
        button.glitchFilter(1);
        button.on('alert', (level: any, tick: any) => {
            if (level === 0) {
                lastSecondEvents.push(new Date().getTime())
                lastSecondEvents = lastSecondEvents.filter((e: any) => 
                    new Date().setSeconds(new Date().getSeconds() - 1) < e)
            }
        });

        setInterval(() => {
            const r = 0.01 // 1cm
            const rps = lastSecondEvents.length
            const rpm = lastSecondEvents.length * 60
            const av = lastSecondEvents.length * 2 * Math.PI
            const ms = av * r
            const kmh = ms * 3.6

            this.io.emit('speed', {
                rps,
                rpm,
                ms,
                kmh
            })
        }, 100)
    }

    private configureDistance() {
        const Gpio = require('pigpio').Gpio;
        const MICROSECDONDS_PER_CM = 1e6 / 34321; // The number of microseconds it takes sound to travel 1cm at 20 degrees celcius
        const trigger = new Gpio(DISTANCE_TRIGGER_PIN, { mode: Gpio.OUTPUT });
        const echo = new Gpio(DISTANCE_ECHO_PIN, { mode: Gpio.INPUT, alert: true });

        trigger.digitalWrite(0); // Make sure trigger is low
        const watchHCSR04 = () => {
            let startTick: any;

            echo.on('alert', async (level: any, tick: any) => {
                if (level == 1) {
                    startTick = tick;
                } else {
                    const endTick = tick;
                    const diff = (endTick >> 0) - (startTick >> 0); // Unsigned 32 bit arithmetic

                    this.distanceCM = diff / 2 / MICROSECDONDS_PER_CM;
                }
            });
        };
        watchHCSR04();

        setInterval(() => {
            trigger.trigger(10, 1); // Set trigger high for 10 microseconds

            this.io.emit('distance', {
                cm: this.distanceCM
            })
        }, 100)
    }

    public getApp (): express.Application {
        return this.app
    }

    public getIo (): any {
        return this.io
    }
}
