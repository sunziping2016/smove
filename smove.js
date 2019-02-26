"use strict";
function defineReactive(obj, key, val) {
    var deps = obj["__deps_" + key] = [];
    Object.defineProperty(obj, key, {
        get: function () {
            if (obj.__target !== null && deps.indexOf(obj.__target) === -1)
                deps.push(obj.__target);
            return val;
        },
        set: function (newValue) {
            val = newValue;
            deps.forEach(function (x) { return x.call(obj); });
        }
    });
}
function defineComputed(obj, key, func) {
    var deps = obj["__deps_" + key] = [], value;
    function update() {
        var _this = this;
        this.__target = update;
        value = func.call(obj);
        this.__target = null;
        deps.forEach(function (x) { return x.call(_this); });
    }
    Object.defineProperty(obj, key, {
        get: function () {
            if (obj.__target !== null && deps.indexOf(obj.__target) === -1)
                deps.push(obj.__target);
            return value;
        }
    });
    update.call(obj);
}
function Reactify(origin, obj) {
    if (obj === undefined)
        obj = {
            __target: null,
            emit: function (name) {
                var _this = this;
                var args = [];
                for (var _i = 1; _i < arguments.length; _i++) {
                    args[_i - 1] = arguments[_i];
                }
                var listeners = this["__event_" + name];
                if (listeners !== undefined)
                    listeners.forEach(function (x) { return x.apply(_this, args); });
            },
            on: function (name, func) {
                var event = "__event_" + name;
                if (this[event] === undefined)
                    this[event] = [func];
                else
                    this[event].push(func);
            }
        };
    if (origin.state !== undefined)
        for (var state in origin.state)
            defineReactive(obj, state, origin.state[state]);
    if (origin.computed !== undefined)
        for (var computed in origin.computed)
            defineComputed(obj, computed, origin.computed[computed]);
    if (origin.watch !== undefined)
        for (var watch in origin.watch)
            obj["__deps_" + watch].push(origin.watch[watch]);
    return obj;
}
var direction = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0]
];
function roundRect(ctx, x, y, width, height, radius) {
    ctx.moveTo(x, y + radius);
    ctx.lineTo(x, y + height - radius);
    ctx.arcTo(x, y + height, x + radius, y + height, radius);
    ctx.lineTo(x + width - radius, y + height);
    ctx.arcTo(x + width, y + height, x + width, y + height - radius, radius);
    ctx.lineTo(x + width, y + radius);
    ctx.arcTo(x + width, y, x + width - radius, y, radius);
    ctx.lineTo(x + radius, y);
    ctx.arcTo(x, y, x, y + radius, radius);
}
var Background = (function () {
    function Background(s) {
        Reactify({
            watch: {
                level: function () {
                    this.backgroundTransition = this.level === 1 ? 1 : 0;
                }
            }
        }, s);
    }
    //noinspection JSMethodCanBeStatic
    Background.prototype.nextTick = function (s) {
        if (s.backgroundTransition !== 1) {
            var transition = s.backgroundTransition + 1 / s.fps / s.backgroundTransitionDuration;
            if (transition >= 1)
                transition = 1;
            s.backgroundTransition = transition;
        }
    };
    //noinspection JSMethodCanBeStatic
    Background.prototype.render = function (s, ctx) {
        ctx.save();
        var grd = ctx.createLinearGradient(0, 0, 0, s.height), transition = (function (t) { return t * (2 - t); })(s.backgroundTransition);
        grd.addColorStop(0, s.levelColor[s.level]);
        if (transition > 0.3)
            grd.addColorStop(transition - 0.3, s.levelColor[s.level]);
        if (transition < 1)
            grd.addColorStop(transition, s.levelColor[s.level - 1]);
        grd.addColorStop(1, s.levelColor[s.level - 1]);
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, s.width, s.height);
        ctx.restore();
    };
    return Background;
}());
var Board = (function () {
    function Board(s) {
    }
    //noinspection JSMethodCanBeStatic
    Board.prototype.render = function (s, ctx) {
        var halfSize = s.boardSize / 2, radius = s.cellSize / 2, lineWidth = s.cellSize / 16, padding = lineWidth * 2;
        ctx.save();
        ctx.translate(s.center[0], s.center[1]);
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        roundRect(ctx, -halfSize - padding, -halfSize - padding, s.boardSize + 2 * padding, s.boardSize + 2 * padding, radius);
        ctx.stroke();
        ctx.lineCap = 'round';
        ctx.lineWidth /= 1.5;
        for (var i = 1; i < 3; ++i) {
            ctx.beginPath();
            ctx.moveTo(-halfSize, -halfSize + s.cellSize * i);
            ctx.lineTo(halfSize, -halfSize + s.cellSize * i);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-halfSize + s.cellSize * i, -halfSize);
            ctx.lineTo(-halfSize + s.cellSize * i, halfSize);
            ctx.stroke();
        }
        ctx.restore();
    };
    return Board;
}());
var Food = (function () {
    function Food(s) {
        Reactify({
            computed: {
                foodColor: function () {
                    return s.levelStep.indexOf(s.score + 1) !== -1 ? 'yellow' : 'blue';
                }
            },
            watch: {
                foodPos: function () {
                    if (this.foodPos !== null) {
                        this.foodAngle = Math.PI / 4;
                        this.foodTransition = 0;
                    }
                }
            }
        }, s);
    }
    //noinspection JSMethodCanBeStatic
    Food.prototype.nextTick = function (s) {
        if (s.foodPos !== null) {
            s.foodAngle += 1 / s.fps * s.foodRotateSpeed;
            if (s.foodTransition !== 1) {
                var transition = s.foodTransition + 1 / s.fps / s.foodTransitionDuration;
                if (transition > 1)
                    transition = 1;
                s.foodTransition = transition;
            }
        }
    };
    //noinspection JSMethodCanBeStatic
    Food.prototype.render = function (s, ctx) {
        if (s.foodPos === null)
            return;
        var foodSize = s.foodTransition * s.foodSize, halfSize = foodSize / 2, radius = foodSize / 8;
        ctx.save();
        ctx.translate(s.center[0] + (s.foodPos[0] - 1) * s.cellSize, s.center[1] + (s.foodPos[1] - 1) * s.cellSize);
        ctx.rotate(s.foodAngle);
        ctx.beginPath();
        ctx.beginPath();
        roundRect(ctx, -halfSize, -halfSize, foodSize, foodSize, radius);
        ctx.fillStyle = s.foodColor;
        ctx.fill();
        ctx.restore();
    };
    //noinspection JSMethodCanBeStatic
    Food.prototype.generate = function (s) {
        var pos = [Math.floor(Math.random() * 3), Math.floor(Math.random() * 3)];
        while (Math.abs(pos[0] - s.playerPos[0]) + Math.abs(pos[1] - s.playerPos[1]) <= 1)
            pos = [Math.floor(Math.random() * 3), Math.floor(Math.random() * 3)];
        s.foodPos = pos;
    };
    return Food;
}());
var Player = (function () {
    function Player(s) {
        Reactify({
            watch: {
                level: function () {
                    if (this.level === 1) {
                        this.playerRealPos = this.playerPos = [1, 1];
                        this.playerMoving = false;
                    }
                }
            }
        }, s);
    }
    //noinspection JSMethodCanBeStatic
    Player.prototype.nextTick = function (s) {
        var dis = 1 / s.fps * s.playerSpeed;
        for (var i = 0; i < 2; ++i) {
            if (Math.abs(s.playerPos[i] - s.playerRealPos[i]) > dis) {
                var temp = s.playerRealPos.slice();
                if (s.playerPos[i] > s.playerRealPos[i])
                    temp[i] += dis;
                else
                    temp[i] -= dis;
                s.playerRealPos = temp;
                break;
            }
            else if (s.playerPos[i] !== s.playerRealPos[i]) {
                s.playerRealPos = s.playerPos.slice();
                s.playerMoving = false;
                break;
            }
        }
    };
    //noinspection JSMethodCanBeStatic
    Player.prototype.render = function (s, ctx) {
        ctx.beginPath();
        ctx.arc(s.center[0] + (s.playerRealPos[0] - 1) * s.cellSize, s.center[1] + (s.playerRealPos[1] - 1) * s.cellSize, s.playerRadius, 0, 2 * Math.PI, false);
        ctx.fillStyle = 'white';
        ctx.fill();
    };
    return Player;
}());
var Bullet = (function () {
    function Bullet(s) {
        var that = this;
        Reactify({
            watch: {
                level: function () {
                    if (this.level === 1) {
                        this.bulletTimer = 1;
                        this.bullets = [];
                        this.emit('levelStart');
                    }
                    else
                        this.bulletTimer = -1.5;
                }
            }
        }, s);
    }
    //noinspection JSMethodCanBeStatic
    Bullet.prototype.nextTick = function (s) {
        var bullets = s.bullets.slice(), i = bullets.length;
        while (i--) {
            var bullet = bullets[i];
            var dis = 1 / s.fps * bullet.speed;
            bullet.pos = [
                bullet.pos[0] + direction[bullet.dir][0] * dis,
                bullet.pos[1] + direction[bullet.dir][1] * dis,
            ];
            if (bullet.pos[0] < s.boarder[3] && bullet.dir === 3 ||
                bullet.pos[0] > s.boarder[1] && bullet.dir === 1 ||
                bullet.pos[1] < s.boarder[0] && bullet.dir === 0 ||
                bullet.pos[1] > s.boarder[2] && bullet.dir === 2)
                bullets.splice(i, 1);
        }
        s.bullets = bullets;
        if (s.state === 'playing') {
            var oldTimer = s.bulletTimer;
            s.bulletTimer += 1 / s.fps;
            if (oldTimer < 0 && s.bulletTimer >= 0)
                s.emit('levelStart');
            switch (s.level) {
                case 1:
                    if (oldTimer <= 1.2 && s.bulletTimer > 1.2) {
                        this.generate(s, Math.floor(Math.random() * 4), Math.floor(Math.random() * 3), 3);
                        s.bulletTimer = 0;
                    }
                    break;
                case 2:
                    if (oldTimer <= 1.2 && s.bulletTimer > 1.2) {
                        var dir = void 0;
                        switch (Math.floor(Math.random() * 5)) {
                            case 0:
                                dir = Math.floor(Math.random() * 2);
                                this.generate(s, dir ? 0 : 2, 0, 3);
                                this.generate(s, dir ? 2 : 0, 2, 3);
                                break;
                            case 1:
                                dir = Math.floor(Math.random() * 2);
                                this.generate(s, dir ? 1 : 3, 0, 3);
                                this.generate(s, dir ? 3 : 1, 2, 3);
                                break;
                            case 2:
                                this.generate(s, 1, 1, 3);
                                this.generate(s, 3, 1, 3);
                                break;
                            case 3:
                                this.generate(s, 0, 1, 3);
                                this.generate(s, 2, 1, 3);
                                break;
                            case 4:
                                dir = Math.floor(Math.random() * 2);
                                this.generate(s, 2, 0, 3);
                                this.generate(s, 0, 2, 3);
                                this.generate(s, 3, 0, 3);
                                this.generate(s, 1, 2, 3);
                                break;
                        }
                        s.bulletTimer = 0;
                    }
                    break;
                case 3:
                    if (oldTimer <= 1.0 && s.bulletTimer > 1.0) {
                        var dir = Math.floor(Math.random() * 4);
                        this.generate(s, dir, 1, [3.4, 3.8][Math.floor(Math.random() * 2)], 0.2);
                        this.generate(s, dir, [0, 2][Math.floor(Math.random() * 2)], 3);
                        s.bulletTimer = 0;
                    }
                    break;
                default:
                    if (oldTimer <= 0.8 && s.bulletTimer > 0.8) {
                        var dir = Math.floor(Math.random() * 4);
                        this.generate(s, dir, 1, 3.4);
                        this.generate(s, dir, [0, 2][Math.floor(Math.random() * 2)], 3.4);
                        s.bulletTimer = 0;
                    }
                    break;
            }
        }
    };
    //noinspection JSMethodCanBeStatic
    Bullet.prototype.render = function (s, ctx) {
        ctx.save();
        ctx.fillStyle = 'black';
        for (var _i = 0, _a = s.bullets; _i < _a.length; _i++) {
            var bullet = _a[_i];
            ctx.beginPath();
            ctx.arc(s.center[0] + (bullet.pos[0] - 1) * s.cellSize, s.center[1] + (bullet.pos[1] - 1) * s.cellSize, s.playerRadius, 0, 2 * Math.PI, false);
            ctx.fill();
        }
        ctx.restore();
    };
    //noinspection JSMethodCanBeStatic
    Bullet.prototype.generate = function (s, dir, line, speed, delay) {
        if (delay === void 0) { delay = 0; }
        var bullet = { speed: speed, dir: dir }, bullets = s.bullets.slice();
        switch (dir) {
            case 0:
                bullet.pos = [line, s.boarder[2] + speed * delay];
                break;
            case 1:
                bullet.pos = [s.boarder[3] - speed * delay, line];
                break;
            case 2:
                bullet.pos = [line, s.boarder[0] - speed * delay];
                break;
            case 3:
                bullet.pos = [s.boarder[1] + speed * delay, line];
                break;
        }
        bullets.push(bullet);
        s.bullets = bullets;
    };
    return Bullet;
}());
var Plus = (function () {
    function Plus(s) {
        var that = this;
        s.on('getScore', function (pos, color) {
            var pluses = this.pluses;
            pluses.push({
                transition: 0,
                pos: [pos[0], pos[1]],
                color: color
            });
            this.pluses = pluses;
        });
    }
    //noinspection JSMethodCanBeStatic
    Plus.prototype.nextTick = function (s) {
        var pluses = s.pluses.slice(), i = pluses.length;
        while (i--) {
            var plus = pluses[i];
            plus.transition += 1 / s.fps / s.plusTransitionDuration;
            if (plus.transition > 1)
                pluses.splice(i, 1);
        }
        s.pluses = pluses;
    };
    //noinspection JSMethodCanBeStatic
    Plus.prototype.render = function (s, ctx) {
        ctx.save();
        ctx.font = s.fontSize * 0.8 + "px sans-serif";
        ctx.textBaseline = 'bottom';
        ctx.textAlign = 'center';
        for (var _i = 0, _a = s.pluses; _i < _a.length; _i++) {
            var plus = _a[_i];
            var alpha = (function (t) { return t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t; })(1 - Math.abs(plus.transition - 0.5) * 2), move = (function (t) { return t * (2 - t); })(plus.transition);
            ctx.fillStyle = plus.color === 'blue' ? "rgba(0,0,255," + alpha + ")" : "rgba(255,255,0," + alpha + ")";
            ctx.fillText('+1', s.center[0] + (plus.pos[0] - 1) * s.cellSize, s.center[1] + (plus.pos[1] - 1) * s.cellSize - (move * s.cellSize / 5 + s.cellSize / 5) * devicePixelRatio);
        }
        ctx.restore();
    };
    return Plus;
}());
var GameOver = (function () {
    function GameOver(s, ctx) {
        this.padding = 10 * devicePixelRatio;
        var that = this;
        Reactify({
            computed: {
                restartButton: function () {
                    ctx.save();
                    ctx.font = this.fontSize * 1.2 + "px sans-serif";
                    var metrics = ctx.measureText('RESTART');
                    ctx.restore();
                    var button = [
                        this.width / 2 - metrics.width / 2 - that.padding,
                        0.6 * this.height,
                        this.width / 2 + metrics.width / 2 + that.padding,
                        0.6 * this.height + this.fontSize * 1.2 + 2 * that.padding,
                    ];
                    if (this.buttons.restart !== undefined)
                        this.buttons.restart = button;
                    return button;
                }
            },
            watch: {
                state: function () {
                    var buttons = Object.assign({}, this.buttons);
                    if (this.state === 'gameOver') {
                        this.gameOverTransition = 0;
                        buttons.restart = this.restartButton;
                    }
                    else if (buttons.restart !== undefined)
                        delete buttons.restart;
                    this.buttons = buttons;
                }
            }
        }, s);
        s.on('click:restart', function () {
            this.score = 0;
            this.state = 'playing';
            this.level = 1;
        });
    }
    //noinspection JSMethodCanBeStatic
    GameOver.prototype.nextTick = function (s) {
        if (s.gameOverTransition === 1)
            return;
        if (s.gameOverTransition < 1) {
            s.gameOverTransition += 1 / s.fps / s.gameOverTransitionDuration;
            if (s.gameOverTransition >= 1) {
                s.gameOverTransition = 1;
                s.fps = 0;
            }
        }
    };
    //noinspection JSMethodCanBeStatic
    GameOver.prototype.preRender = function (s, ctx) {
        var transition = (function (t) { return t * (2 - t); })(s.gameOverTransition);
        ctx.save();
        //ctx.translate((s.playerPos[0] - 1) * s.cellSize, (s.playerPos[1] - 1) * s.cellSize);
        ctx.translate(s.center[0] + (s.playerRealPos[0] - 1) * s.cellSize, s.center[1] + (s.playerRealPos[1] - 1) * s.cellSize);
        ctx.scale(transition * 5 + 1, transition * 5 + 1);
        ctx.rotate(Math.PI / 4 * transition);
        ctx.translate(-s.center[0] - (s.playerRealPos[0] - 1) * s.cellSize, -s.center[1] - (s.playerRealPos[1] - 1) * s.cellSize);
    };
    //noinspection JSMethodCanBeStatic
    GameOver.prototype.render = function (s, ctx, canvas) {
        ctx.restore();
        ctx.save();
        var blur = (function (t) { return t * (2 - t); })(s.gameOverTransition), transition = (function (t) { return t * (2 - t); })(s.gameOverTransition < 0.2 ? s.gameOverTransition / 0.2 : 1);
        if (!s.mobile)
            StackBlur.canvasRGB(canvas, 0, 0, s.width, s.height, blur * 40 * devicePixelRatio);
        var rgb = s.levelColor[s.level].slice(1);
        ctx.fillStyle = "rgba(" + parseInt(rgb.slice(0, 2), 16) + "," + parseInt(rgb.slice(2, 4), 16) + "," + parseInt(rgb.slice(4), 16) + "," + blur * 0.6 + ")";
        ctx.fillRect(0, 0, s.width, s.height);
        ctx.shadowColor = "rgba(0,0,0," + 0.5 * transition + ")";
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowBlur = 5 * devicePixelRatio;
        ctx.font = Math.floor(s.fontSize * 1.5) + "px sans-serif";
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillStyle = "rgba(255,255,255," + transition + ")";
        ctx.fillText('GAME OVER', s.center[0], (s.center[1] - s.cellSize * 1.5) / 2);
        ctx.font = Math.floor(s.fontSize * 4) + "px sans-serif";
        ctx.textBaseline = 'bottom';
        ctx.fillText("" + s.score, s.center[0], s.center[1]);
        ctx.font = Math.floor(s.fontSize * 1.2) + "px sans-serif";
        ctx.textBaseline = 'top';
        ctx.beginPath();
        roundRect(ctx, s.restartButton[0], s.restartButton[1], s.restartButton[2] - s.restartButton[0], s.restartButton[3] - s.restartButton[1], this.padding);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(0,255,0," + transition + ")";
        ctx.fillText('RESTART', s.center[0], 0.6 * s.height + this.padding);
        ctx.restore();
    };
    return GameOver;
}());
var Tooltip = (function () {
    function Tooltip(s) {
    }
    //noinspection JSMethodCanBeStatic
    Tooltip.prototype.nextTick = function (s) {
        if (s.tooltipTransition === 0 && s.state !== 'preparing')
            return;
        s.tooltipTransition += 1 / s.fps / s.tooltipTransitionDuration;
        if (s.tooltipTransition >= 1)
            s.tooltipTransition = 0;
    };
    //noinspection JSMethodCanBeStatic
    Tooltip.prototype.render = function (s, ctx) {
        var alpha = (function (t) { return t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t; })(1 - Math.abs(s.tooltipTransition - 0.5) * 2);
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0," + 0.5 * alpha + ")";
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowBlur = 5 * devicePixelRatio;
        ctx.font = s.fontSize + "px sans-serif";
        ctx.textBaseline = 'bottom';
        ctx.textAlign = 'center';
        ctx.fillStyle = "rgba(255,255,255," + alpha + ")";
        ctx.fillText('MOVE TO START', s.width / 2, (s.center[1] - s.cellSize * 1.5) / 2);
        ctx.restore();
    };
    return Tooltip;
}());
var Level = (function () {
    function Level(s) {
        Reactify({
            watch: {
                level: function () {
                    this.levelTransition += 1 / this.fps / this.levelTransitionDuration;
                }
            }
        }, s);
    }
    //noinspection JSMethodCanBeStatic
    Level.prototype.nextTick = function (s) {
        if (s.levelTransition === 0)
            return;
        s.levelTransition += 1 / s.fps / s.levelTransitionDuration;
        if (s.levelTransition >= 1)
            s.levelTransition = 0;
    };
    //noinspection JSMethodCanBeStatic
    Level.prototype.render = function (s, ctx) {
        var alpha = (function (t) { return t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t; })(1 - Math.abs(s.levelTransition - 0.5) * 2);
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0," + 0.5 * alpha + ")";
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowBlur = 5 * devicePixelRatio;
        ctx.font = s.fontSize * 1.5 + "px sans-serif";
        ctx.textBaseline = 'top';
        ctx.textAlign = 'center';
        ctx.fillStyle = "rgba(255,255,255," + alpha + ")";
        ctx.fillText("LEVEL " + s.level, s.width / 2, (s.center[1] - s.cellSize * 1.5) / 2);
        ctx.restore();
    };
    return Level;
}());
var Score = (function () {
    function Score(s) {
        Reactify({
            watch: {
                score: function () {
                    if (this.score !== 0 && (this.scoreTransition === 0 || this.scoreTransition === 0.5))
                        this.scoreTransition += 1 / this.fps / this.scoreTransitionDuration;
                },
                state: function () {
                    if (this.state === 'gameOver' && this.scoreTransition === 0.5)
                        this.scoreTransition += 1 / this.fps / this.scoreTransitionDuration;
                }
            }
        }, s);
    }
    //noinspection JSMethodCanBeStatic
    Score.prototype.nextTick = function (s) {
        if (s.scoreTransition === 0 || s.scoreTransition === 0.5)
            return;
        var oldTransition = s.scoreTransition;
        s.scoreTransition += 1 / s.fps / s.scoreTransitionDuration;
        if (oldTransition < 0.5 && s.scoreTransition >= 0.5) {
            s.scoreTransition = 0.5;
            s.oldScore = s.score;
        }
        else if (s.scoreTransition >= 1) {
            if (s.state === 'playing')
                s.scoreTransition = 1 / s.fps / s.scoreTransitionDuration;
            else
                s.scoreTransition = 0;
        }
    };
    //noinspection JSMethodCanBeStatic
    Score.prototype.render = function (s, ctx) {
        var transition = 1 - Math.abs(s.scoreTransition - 0.5) * 2, alpha = (function (t) { return t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t; })(transition), move = (function (t) { return t * (2 - t); })(1 - transition);
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0," + 0.5 * alpha + ")";
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowBlur = 5 * devicePixelRatio;
        ctx.font = s.fontSize * 3 + "px sans-serif";
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.fillStyle = "rgba(255,255,255," + alpha + ")";
        ctx.fillText("" + (s.scoreTransition <= 0.5 ? s.score : s.oldScore), s.padding, s.fontSize * 2 + move * 6 * devicePixelRatio);
        ctx.restore();
    };
    return Score;
}());
var Toobar = (function () {
    function Toobar(s, ctx) {
        Reactify({
            computed: {
                pauseButton: function () {
                    ctx.save();
                    ctx.font = this.fontSize + "px FontAwesome";
                    var metrics = ctx.measureText(this.pauseText);
                    ctx.restore();
                    return this.buttons.pause = [
                        this.width - this.padding - metrics.width, this.padding,
                        this.width - this.padding, this.padding + this.fontSize,
                    ];
                }
            }
        }, s);
        s.on('click:pause', function () {
            this.paused = !this.paused;
        });
    }
    //noinspection JSMethodCanBeStatic
    Toobar.prototype.render = function (s, ctx) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowBlur = 5 * devicePixelRatio;
        ctx.fillStyle = 'white';
        ctx.font = s.fontSize + "px sans-serif";
        ctx.textBaseline = 'top';
        ctx.fillText("BEST: " + s.bestScore, s.padding, s.padding);
        ctx.font = s.fontSize + "px FontAwesome";
        ctx.textAlign = 'right';
        ctx.fillText(s.pauseText, s.width - s.padding, s.padding);
        ctx.restore();
    };
    return Toobar;
}());
var App = (function () {
    function App(canvas) {
        var _this = this;
        var that = this, mobile = !!(navigator.userAgent.match(/Android/i)
            || navigator.userAgent.match(/webOS/i)
            || navigator.userAgent.match(/iPhone/i)
            || navigator.userAgent.match(/iPad/i)
            || navigator.userAgent.match(/iPod/i)
            || navigator.userAgent.match(/BlackBerry/i)
            || navigator.userAgent.match(/Windows Phone/i));
        this.canvas = canvas;
        this.context = canvas.getContext('2d');
        canvas.width = devicePixelRatio * canvas.clientWidth;
        canvas.height = devicePixelRatio * canvas.clientHeight;
        this.state = Reactify({
            state: {
                width: canvas.width,
                height: canvas.height,
                fps: mobile ? 30 : 50,
                level: 1,
                state: "preparing",
                paused: false,
                levelColor: [
                    '#f18781',
                    '#faaa79',
                    '#6ec489',
                    '#aaa4d0',
                    '#0e95d1',
                ],
                levelStep: [10, 20, 30],
                best: 0,
                score: 0,
                oldScore: 0,
                bestScore: 0,
                playerPos: [1, 1],
                playerRealPos: [1, 1],
                playerMoving: false,
                playerSpeed: 12,
                foodPos: null,
                foodAngle: 0,
                foodRotateSpeed: Math.PI / 3,
                foodTransition: 0,
                foodTransitionDuration: 0.2,
                padding: 20 * devicePixelRatio,
                backgroundTransition: 1,
                backgroundTransitionDuration: 4,
                tooltipTransition: 0,
                tooltipTransitionDuration: 3,
                levelTransition: 0,
                levelTransitionDuration: 2,
                scoreTransition: 0,
                scoreTransitionDuration: 0.3,
                gameOverTransition: 0,
                gameOverTransitionDuration: 4,
                plusTransitionDuration: 0.5,
                pluses: [],
                buttons: {},
                bulletTimer: 1,
                bullets: [],
                mobile: mobile
            },
            computed: {
                center: function () { return [this.width / 2, this.height / 2]; },
                boardSize: function () {
                    return Math.min(this.width / 2.4, this.height / 2.4, 300 * devicePixelRatio);
                },
                cellSize: function () { return this.boardSize / 3; },
                playerRadius: function () { return this.cellSize * 0.34; },
                foodSize: function () { return this.cellSize * 0.3; },
                fontSize: function () { return Math.min(Math.floor(this.cellSize * 0.5), 40 * devicePixelRatio); },
                pauseText: function () { return this.paused ? '\uf04b' : '\uf04c'; },
                boarder: function () {
                    var larger = Math.max(this.height, this.width);
                    return [
                        -larger * 0.5 / this.cellSize + 0.5,
                        larger * 0.5 / this.cellSize + 1.5,
                        larger * 0.5 / this.cellSize + 1.5,
                        -larger * 0.5 / this.cellSize + 0.5,
                    ];
                }
            },
            watch: {
                fps: function () {
                    if (_this.interval !== null)
                        clearInterval(_this.interval);
                    if (_this.state.fps !== 0)
                        _this.interval = setInterval(function () {
                            _this.nextTick();
                            _this.render();
                        }, 1000 / _this.state.fps);
                    else {
                        _this.render();
                        _this.interval = null;
                    }
                },
                width: function () {
                    canvas.width = this.width;
                },
                height: function () {
                    canvas.height = this.height;
                },
                playerPos: function () {
                    if (this.playerPos[0] !== this.playerRealPos[0] || this.playerPos[1] !== this.playerRealPos[1])
                        this.playerMoving = true;
                },
                score: function () {
                    if (this.score > this.bestScore)
                        this.bestScore = this.score;
                },
                state: function () {
                    if (this.state !== 'gameOver') {
                        if (this.mobile) {
                            if (this.fps !== 30)
                                this.fps = 30;
                        }
                        else if (this.fps !== 50)
                            this.fps = 50;
                    }
                    else if (this.fps !== 25)
                        this.fps = 25;
                },
                paused: function () {
                    if (this.paused) {
                        this.fps = 0;
                        that.render();
                    }
                    else
                        this.fps = this.state === 'gameOver' ? 25 : (this.mobile ? 30 : 50);
                }
            }
        });
        this.background = new Background(this.state);
        this.board = new Board(this.state);
        this.food = new Food(this.state);
        this.player = new Player(this.state);
        this.bullet = new Bullet(this.state);
        this.plus = new Plus(this.state);
        this.gameOver = new GameOver(this.state, this.context);
        this.tooltip = new Tooltip(this.state);
        this.level = new Level(this.state);
        this.score = new Score(this.state);
        this.toolbar = new Toobar(this.state, this.context);
        this.state.on('levelStart', function () { return _this.food.generate(_this.state); });
        this.food.generate(this.state);
        this.interval = setInterval(function () {
            _this.nextTick();
            _this.render();
        }, 1000 / this.state.fps);
    }
    App.prototype.render = function () {
        if (this.state.state === 'gameOver')
            this.gameOver.preRender(this.state, this.context);
        this.background.render(this.state, this.context);
        this.board.render(this.state, this.context);
        this.food.render(this.state, this.context);
        this.player.render(this.state, this.context);
        this.bullet.render(this.state, this.context);
        this.plus.render(this.state, this.context);
        if (this.state.state === 'gameOver')
            this.gameOver.render(this.state, this.context, this.canvas);
        this.tooltip.render(this.state, this.context);
        this.level.render(this.state, this.context);
        this.score.render(this.state, this.context);
        this.toolbar.render(this.state, this.context);
    };
    App.prototype.nextTick = function () {
        if (this.state.paused)
            return;
        if (this.state.state !== 'gameOver') {
            this.background.nextTick(this.state);
            this.food.nextTick(this.state);
            this.player.nextTick(this.state);
            this.bullet.nextTick(this.state);
            this.plus.nextTick(this.state);
        }
        else
            this.gameOver.nextTick(this.state);
        this.tooltip.nextTick(this.state);
        this.level.nextTick(this.state);
        this.score.nextTick(this.state);
        // Check for collision and food
        if (this.state.state === 'playing') {
            for (var _i = 0, _a = this.state.bullets; _i < _a.length; _i++) {
                var bullet = _a[_i];
                var diff = [
                    bullet.pos[0] - this.state.playerRealPos[0],
                    bullet.pos[1] - this.state.playerRealPos[1]
                ];
                if (diff[0] * diff[0] + diff[1] * diff[1] < 4 * 0.34 * 0.34) {
                    this.state.state = 'gameOver';
                    break;
                }
            }
        }
        if (this.state.state === 'playing' &&
            this.state.foodPos !== null &&
            this.state.playerRealPos[0] === this.state.foodPos[0] &&
            this.state.playerRealPos[1] === this.state.foodPos[1]) {
            this.state.emit('getScore', this.state.foodPos.slice(), this.state.foodColor);
            this.state.score += 1;
            var newLevel = this.state.levelStep.indexOf(this.state.score);
            if (newLevel === -1)
                this.food.generate(this.state);
            else {
                this.state.foodPos = null;
                this.state.level = newLevel + 2;
            }
        }
    };
    App.prototype.updateSize = function () {
        if (this.state.width !== devicePixelRatio * this.canvas.clientWidth)
            this.state.width = devicePixelRatio * this.canvas.clientWidth;
        if (this.state.height !== devicePixelRatio * this.canvas.clientHeight)
            this.state.height = devicePixelRatio * this.canvas.clientHeight;
        this.render();
    };
    App.prototype.move = function (dir) {
        if (this.state.paused || this.state.playerMoving)
            return;
        if (this.state.state === 'preparing')
            this.state.state = 'playing';
        if (this.state.state !== 'playing')
            return;
        var newPos = [this.state.playerPos[0] + direction[dir][0], this.state.playerPos[1] + direction[dir][1]];
        if (newPos[0] < 0 || newPos[0] >= 3 || newPos[1] < 0 || newPos[1] >= 3)
            return;
        this.state.playerPos = newPos;
    };
    return App;
}());
(function () {
    var canvas = document.getElementById('canvas'), app = window.app = new App(canvas);
    window.addEventListener('resize', function () { return app.updateSize(); });
    document.addEventListener('keydown', function (event) {
        switch (event.key) {
            case 'ArrowUp':
                app.move(0);
                break;
            case 'ArrowRight':
                app.move(1);
                break;
            case 'ArrowDown':
                app.move(2);
                break;
            case 'ArrowLeft':
                app.move(3);
                break;
        }
    });
    var xDown = null, yDown = null;
    canvas.addEventListener('touchstart', function (event) {
        xDown = event.touches[0].clientX;
        yDown = event.touches[0].clientY;
    });
    canvas.addEventListener('touchmove', function (event) {
        event.preventDefault();
        if (xDown === null || yDown === null)
            return;
        var xDiff = xDown - event.touches[0].clientX, yDiff = yDown - event.touches[0].clientY;
        if (xDiff * xDiff + yDiff * yDiff < 16)
            return;
        //noinspection JSSuspiciousNameCombination
        if (Math.abs(xDiff) > Math.abs(yDiff))
            app.move(xDiff > 0 ? 3 : 1);
        else
            app.move(yDiff > 0 ? 0 : 2);
        xDown = null;
        yDown = null;
    });
    canvas.addEventListener('mousemove', function (event) {
        var pointer = false;
        for (var name_1 in app.state.buttons) {
            //noinspection JSUnfilteredForInLoop
            var button = app.state.buttons[name_1];
            if (event.clientX * devicePixelRatio >= button[0] &&
                event.clientX * devicePixelRatio <= button[2] &&
                event.clientY * devicePixelRatio >= button[1] &&
                event.clientY * devicePixelRatio <= button[3]) {
                pointer = true;
                break;
            }
        }
        canvas.style.cursor = pointer ? 'pointer' : null;
    });
    canvas.addEventListener('click', function (event) {
        for (var name_2 in app.state.buttons) {
            //noinspection JSUnfilteredForInLoop
            var button = app.state.buttons[name_2];
            if (event.clientX * devicePixelRatio >= button[0] &&
                event.clientX * devicePixelRatio <= button[2] &&
                event.clientY * devicePixelRatio >= button[1] &&
                event.clientY * devicePixelRatio <= button[3])
                //noinspection JSUnfilteredForInLoop
                app.state.emit("click:" + name_2);
        }
    });
})();
