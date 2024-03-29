/* 
 * Version 0.2.94
 * Made By Robin Kuiper
 * Changes in Version 0.2.1 by The Aaron
 * Changes in Version 0.2.8, 0.2.81, 0.2.82 by Victor B
 * Skype: RobinKuiper.eu
 * Discord: Atheos#1095
 * My Discord Server: https://discord.gg/AcC9VMEG
 * Roll20: https://app.roll20.net/users/1226016/robin
 * Roll20 Thread: https://app.roll20.net/forum/post/6349145/script-combattracker
 * Github: https://github.com/RobinKuiper/Roll20APIScripts
 * Reddit: https://www.reddit.com/user/robinkuiper/
 * Patreon: https://patreon.com/robinkuiper
 * Paypal.me: https://www.paypal.me/robinkuiper
*/

/* TODO
 *
 * Styling
 * More chat message options
 * Show menu with B shows always
 * Add icon if not StatusInfo (?)    (IF YES, remove conditions on statusmarker remove)
 * Edit Conditions
*/
/* globals StatusInfo, TokenMod */

var CombatTracker = CombatTracker || (function() {
    'use strict';

    let round = 1,
        timerObj,
        intervalHandle,
        rotationInterval,
        paused = false,
        observers = {
            tokenChange: []
        },
        extensions = {
            StatusInfo: true // This will be set to true automatically if you have StatusInfo
        };

    // Styling for the chat responses.
    const styles = {
        reset: 'padding: 0; margin: 0;',
        menu:  'background-color: #fff; border: 1px solid #000; padding: 5px; border-radius: 5px;',
        button: 'background-color: #000; border: 1px solid #292929; border-radius: 3px; padding: 5px; color: #fff; text-align: center;',
        textButton: 'background-color: transparent; border: none; padding: 0; color: #000; text-decoration: underline',
        list: 'list-style: none;',
        float: {
            right: 'float: right;',
            left: 'float: left;'
        },
        overflow: 'overflow: hidden;',
        fullWidth: 'width: 100%;',
        underline: 'text-decoration: underline;',
        strikethrough: 'text-decoration: strikethrough'
    },
    script_name = 'CombatTracker',
    state_name = 'COMBATTRACKER',

    handleInput = (msg) => {
 //       if (msg.type != 'api') return;
        if (msg.content.indexOf('!ct')!==0){
            return;
        }
        let args = msg.content.split(' ');
        let command = args.shift().substring(1);
        let extracommand = args.shift();

        if(command !== state[state_name].config.command) return;

        if(extracommand === 'next'){
            if(!getTurnorder().length) return;

            if(playerIsGM(msg.playerid) || msg.playerid === 'api'){
                NextTurn();
                return;
            }

            let turn = getCurrentTurn(),
                token = getObj('graphic', turn.id);
            if(token){
                let character = getObj('character', token.get('represents'));
                if((token.get('controlledby').split(',').includes(msg.playerid) || token.get('controlledby').split(',').includes('all')) ||
                    (character && (character.get('controlledby').split(',').includes(msg.playerid) || character.get('controlledby').split(',').includes(msg.playerid)))){
                        NextTurn();
                        // SHOW MENU
                    }
            }
        }

        // Below commands are only for GM's
        if(!playerIsGM(msg.playerid)) return;

        let name, duration, direction, message, condition;

        switch(extracommand){
            case 'help':
                sendHelpMenu();
            break;

            case 'reset':
                switch(args.shift()){
                    case 'conditions':
                        state[state_name].conditions = {};
                    break;

                    default:
                        state[state_name] = {};
                        setDefaults(true);
                        sendConfigMenu();
                    break;
                }
            break;

            case 'config':
                if(args[0] === 'timer'){
                    if(args[1]){
                        let setting = args[1].split('|');
                        let key = setting.shift();
                        let value = (setting[0] === 'true') ? true : (setting[0] === 'false') ? false : setting[0];

                        state[state_name].config.timer[key] = value;
                    }

                    sendConfigTimerMenu();
                }else if (args[0] === 'turnorder'){
                    if(args[1]){
                        let setting = args[1].split('|');
                        let key = setting.shift();
                        let value = (setting[0] === 'true') ? true : (setting[0] === 'false') ? false : setting[0];

                        if(key === 'ini_die') value = parseInt(value);

                        state[state_name].config.turnorder[key] = value;
                    }

                    sendConfigTurnorderMenu();
                }else if (args[0] === 'announcements'){
                    if(args[1]){
                        let setting = args[1].split('|');
                        let key = setting.shift();
                        let value = (setting[0] === 'true') ? true : (setting[0] === 'false') ? false : setting[0];

                        state[state_name].config.announcements[key] = value;
                    }

                    sendConfigAnnounceMenu();
                }else if (args[0] === 'macro'){
                    if(args[1]){
                        let setting = args[1].split('|');
                        let key = setting.shift();
                        let value = (setting[0] === 'true') ? true : (setting[0] === 'false') ? false : setting[0];

                        state[state_name].config.macro[key] = value;
                    }

                    sendConfigMacroMenu();
                }else{
                    if(args[0]){
                        let setting = args.shift().split('|');
                        let key = setting.shift();
                        let value = (setting[0] === 'true') ? true : (setting[0] === 'false') ? false : setting[0];

                        state[state_name].config[key] = value;
                    }

                    sendConfigMenu();
                }                 
            break;

            case 'sort':
                sortTurnorder();
            break;

            case 'prev':
                PrevTurn();
            break;

            case 'start':
                startCombat(msg.selected);

                if(args.shift() === 'b') sendMenu();
            break;

            case 'stop':
                stopCombat();

                if(args.shift() === 'b') sendMenu();
            break;

            case 'st':
                stopTimer();

                if(args.shift() === 'b') sendMenu();
            break;

            case 'pt':
                pauseTimer();

                if(args.shift() === 'b') sendMenu();
            break;

            case 'conditions':
                sendConditionsMenu();
            break;

            case 'show': {
                if(!msg.selected || !msg.selected.length){
                    makeAndSendMenu('No tokens are selected.', '', 'gm');
                    return;
                }

                let tokens = msg.selected.map(s => getObj('graphic', s._id));

                sendTokenConditionMenu(tokens, (args.shift() === 'p'));
			}
            break;

            case 'add':
                name = args.shift();
                if(!name){
                    makeAndSendMenu('No condition name was given.', '', 'gm');
                    return;
                }
                duration = args.shift();
                duration = (!duration || duration === 0) ? 'none' : duration;
                direction = args.shift() || 0;
                message = args.join(' ');
                condition = { name, duration, direction, message };

                if(!msg.selected || !msg.selected.length){
                    let tokenid = args.shift();
                    let token = getObj('graphic', tokenid);
                    if(!tokenid || !token){
                        makeAndSendMenu('No tokens were selected.', '', 'gm');
                        return;
                    }

                    addCondition(token, condition, true);
                    
                    return;
                }

                msg.selected.forEach(s => {
                    let token = getObj(s._type, s._id);
                    if(!token) return;

                    addCondition(token, condition, true);
                });
            break;

            case 'addfav':
                name= args.shift();
                duration = args.shift();
                direction = args.shift() || -1;
                message = args.join(' ');
                condition = { name, duration, direction, message };

                addOrEditFavoriteCondition(condition);

                sendFavoritesMenu();
            break;

            case 'editfav':
                name = args.shift();

                if(!name){
                    makeAndSendMenu('No condition name was given.', '', 'gm');
                    return;
                }

                name = strip(name).toLowerCase();
                condition = state[state_name].favorites[name];

                if(!condition){
                    makeAndSendMenu('Condition does not exists.', '', 'gm');
                    return;
                }                

                if(args[0]){
                    let setting = args.shift().split('|');
                    let key = setting.shift();
                    let value = (setting[0] === 'true') ? true : (setting[0] === 'false') ? false : setting[0];

                    state[state_name].favorites[name][key] = value;

                    if(key === 'name'){
                        state[state_name].favorites[strip(value).toLowerCase()] = state[state_name].favorites[name];
                        delete state[state_name].favorites[name];
                    }
                }

                sendEditFavoriteConditionMenu(condition);
            break;

            case 'removefav':
                removeFavoriteCondition(args.shift());

                sendFavoritesMenu();
            break;

            case 'favorites':
                sendFavoritesMenu();
            break;

            case 'remove': {
                let cname = args.shift();
                let tokenid = args.shift();
                let token;

                if(!cname){
                    makeAndSendMenu('No condition was given.', '', 'gm');
                    return;
                }

                if(tokenid){
                    token = getObj('graphic', tokenid);
                    if(token){
                        removeCondition(token, cname);
                        sendTokenConditionMenu([token]);
                        return;
                    }
                }

                if(!msg.selected || !msg.selected.length){
                    makeAndSendMenu('No tokens were selected.', '', 'gm');
                    return;
                }

                msg.selected.forEach(s => {
                    token = getObj(s._type, s._id);
                    if(!token) return;

                    removeCondition(token, cname);
                });
			}
            break;

            case 'showcondition': {
                let cname = args.shift();
                let tokenid = args.shift();
                let token;

                if(!cname){
                    makeAndSendMenu('No condition was given.', '', 'gm');
                    return;
                }

                if(tokenid){
                    token = getObj('graphic', tokenid);
                    if(token){
                        showCondition(token, cname);
                    }
                }
            }
            break;

            default:
                sendMenu();
            break;
        }
    },

    addOrEditFavoriteCondition = (condition) => {
        if(condition.duration === 0 || condition.duration === '') condition.duration = undefined;

        let strippedName = strip(condition.name).toLowerCase();

        state[state_name].favorites[strippedName] = condition;
    },

    removeFavoriteCondition = (name) => {
        name = strip(name).toLowerCase();

        delete state[state_name].favorites[name];
    },

    addCondition = (token, condition, announce=false) => {

        if(!condition.duration || condition.duration === 0 || condition.duration === '0' || condition.duration === '' || condition.duration === 'none') condition.duration = undefined;

        if(state[state_name].conditions[strip(token.get('id')).toLowerCase()]){
            log('Adding Condition')
            state[state_name].conditions[strip(token.get('id')).toLowerCase()].forEach(c => {
                log (c.name.toLowerCase())
                log(condition.name.toLowerCase())
                if(c.name.toLowerCase() === condition.name.toLowerCase()) {
                    removeCondition(token, condition.name.toLowerCase());   
                }    
            });

            state[state_name].conditions[strip(token.get('id')).toLowerCase()].push(condition);
        }else{
            state[state_name].conditions[strip(token.get('id')).toLowerCase()] = [condition];
        }        
        
        if(extensions.StatusInfo){
            /*const duration = condition.duration;
            const direction = condition.direction;
            const message = condition.message;*/
            let si_condition = StatusInfo.getConditionByName(condition.name) || condition;
            condition.name = si_condition.name;
            condition.icon = si_condition.icon;
            if (parseInt(condition.duration) > 1) {
                if (condition.name.toLowerCase() == 'dead') {
                    token.set('status_'+condition.icon, true);
                } else {    
                    token.set('status_'+condition.icon, parseInt(condition.duration));
                }    
            } else {
                token.set('status_'+condition.icon, true);
            }
            if(announce && extensions.StatusInfo){
                StatusInfo.sendConditionToChat(si_condition);
            }            
        }


        if(!condition.icon){
            makeAndSendMenu('Condition ' + condition.name + ' added to ' + token.get('name'));
        }    
    },

    removeCondition = (token, condition_name, auto=false) => {
        if(!state[state_name].conditions[strip(token.get('id')).toLowerCase()]) return;

        let si_condition = false;
        if(extensions.StatusInfo){
            si_condition = StatusInfo.getConditionByName(condition_name) || false;
        }

        state[state_name].conditions[strip(token.get('id')).toLowerCase()].forEach((condition, i) => {
            if(condition.name.toLowerCase() !== condition_name.toLowerCase()) return;

            state[state_name].conditions[strip(token.get('id')).toLowerCase()].splice(i, 1);

            if(si_condition){
                token.set('status_'+condition.icon, false);
            }else if(!auto){
                makeAndSendMenu('Condition ' + condition.name + ' removed from ' + token.get('name'));
            }
        });
    },

    showCondition = (token, condition_name) => {
        if(!state[state_name].conditions[strip(token.get('id')).toLowerCase()]) return;

        let si_condition = false;
        if(extensions.StatusInfo){
            si_condition = StatusInfo.getConditionByName(condition_name) || false;
        }

        state[state_name].conditions[strip(token.get('id')).toLowerCase()].forEach((condition, i) => {
            if(condition.name.toLowerCase() !== condition_name.toLowerCase()) return;

            if(si_condition){
                StatusInfo.sendConditionToChat(si_condition);
            }
            if(condition.message) makeAndSendMenu(condition.message, condition.name, '');
        });
    },

    strip = (str) => {
        return str.replace(/[^a-zA-Z0-9]+/g, '_');
    },

    handleTurnorderChange = (obj, prev) => {
        if(obj.get('turnorder') === prev.turnorder) return;

        let turnorder = (obj.get('turnorder') === "") ? [] : JSON.parse(obj.get('turnorder'));
        let prevTurnorder = (prev.turnorder === "") ? [] : JSON.parse(prev.turnorder);

        if(obj.get('turnorder') === "[]"){
            resetMarker();
            stopTimer();
            return;
        }

        if(turnorder.length && prevTurnorder.length && turnorder[0].id !== prevTurnorder[0].id){
            doTurnorderChange();
        }
    },

    handleStatusMarkerChange = (obj, prev) => {
        if(extensions.StatusInfo){
            prev.statusmarkers = (typeof prev.get === 'function') ? prev.get('statusmarkers') : prev.statusmarkers;

            if(obj.get('statusmarkers') !== prev.statusmarkers){
                let nS = obj.get('statusmarkers').split(','),
                    oS = prev.statusmarkers.split(',');

                // Marker added?
                array_diff(oS, nS).forEach(icon => {
                    if(icon === '') return;

                    getObjects(StatusInfo.getConditions(), 'icon', icon).forEach(condition => {
                        addCondition(obj, { name: condition.name });
                    });
                });

                // Marker Removed?
                array_diff(nS, oS).forEach(icon => {
                    if(icon === '') return;

                    getObjects(StatusInfo.getConditions(), 'icon', icon).forEach(condition => {
                        removeCondition(obj, condition.name);
                    });
                });
            }
        }
    },

    handleGraphicMovement = (obj /*, prev */) => {
        if(!inFight()) return;

        if(getCurrentTurn().id === obj.get('id')){
            changeMarker(obj);
        }

        if(getNextTurn().id === obj.get('id')){
            changeMarker(obj, true);
        }
    },

    array_diff = (a, b) => {
        return b.filter(function(i) {return a.indexOf(i) < 0;});
    },

    //return an array of objects according to key, value, or key and value matching
    getObjects = (obj, key, val) => {
        var objects = [];
        for (var i in obj) {
            if (!obj.hasOwnProperty(i)) continue;
            if (typeof obj[i] == 'object') {
                objects = objects.concat(getObjects(obj[i], key, val));    
            } else 
            //if key matches and value matches or if key matches and value is not passed (eliminating the case where key matches but passed value does not)
            if (i == key && obj[i] == val || i == key && val == '') { //
                objects.push(obj);
            } else if (obj[i] == val && key == ''){
                //only add if the object is not already in the array
                if (objects.lastIndexOf(obj) == -1){
                    objects.push(obj);
                }
            }
        }
        return objects;
    },

    startCombat = (selected) => {
        paused = false;
        resetMarker();
        Campaign().set('initiativepage', Campaign().get('playerpageid'));

        if(selected && state[state_name].config.turnorder.throw_initiative){
            rollInitiative(selected, state[state_name].config.turnorder.auto_sort);
        }
        
        doTurnorderChange();
    },

    inFight = () => {
        return (Campaign().get('initiativepage') !== false);
    },

    rollInitiative = (selected, sort) => {
        let config = state[state_name].config;

        selected.forEach(s => {
            if(s._type !== 'graphic') return;

            let token = getObj('graphic', s._id),
                whisper = (token.get('layer') === 'gmlayer') ? 'gm ' : '',
                bonus=0.0,
                rollInit = (config.turnorder.ini_die) ? randomInteger(config.turnorder.ini_die) : 0;

            if (token.get('represents') > "") { 
                let character = getObj('character', token.get('represents')),
                initAttributes = state[state_name].config.initiative_attribute_name.split(','),
                init=0,
                i=0;    

                for (i=0;i<initAttributes.length;i++) {
                    if (character != 'undefined') {
                        init = getAttrByName(character.id,initAttributes[i],'current') 
                        bonus = bonus + parseFloat(init)
                    }    
                } 
                
                let rollAdvantage = getAttrByName(character.id, 'initiative_style', 'current');
                if (rollAdvantage) {
                    if (rollAdvantage == '{@{d20},@{d20}}kh1') {
                        let rollInit1 = randomInteger(20) 
                        let rollInit2 = randomInteger(20) 
                        if (rollInit1 >= rollInit2) {
                            rollInit = rollInit1
                        } else {
                            rollInit = rollInit2
                        }
                        if(state[state_name].config.turnorder.show_initiative_roll){
                            let contents = ' \
                               <table style="width: 50%; text-align: left; float: left;"> \
                                    <tr> \
                                        <th>Modifier</th> \
                                        <td>'+bonus+'</td> \
                                    </tr> \
                                </table> \
                                <div style="text-align: center"> \
                                    <b style="font-size: 14pt;"> \
                                        <span style="border: 1px solid green; padding-bottom: 2px; padding-top: 4px;">[['+rollInit1+'+'+bonus+']]</span><br><br> \
                                    </b> \
                                </div> \
                                <div style="text-align: center"> \
                                    <b style="font-size: 10pt;"> \
                                        <span style="border: 1px solid red; padding-bottom: 2px; padding-top: 4px;">[['+rollInit2+'+'+bonus+']]</span><br><br> \
                                    </b> \
                                </div>'                                
                            makeAndSendMenu(contents, token.get('name') + ' Initiative', whisper);
                        }
                    } else if(state[state_name].config.turnorder.show_initiative_roll) { 
                        
                        let contents = ' \
                        <table style="width: 100%; text-align: left;"> \
                            <tr> \
                                <th>Modifier</th> \
                                <td>'+bonus+'</td> \
                            </tr> \
                        </table> \
                        <div style="text-align: center"> \
                            <b style="font-size: 16pt;"> \
                                <span style="border: 1px solid green; padding-bottom: 2px; padding-top: 4px;">[['+rollInit+'+'+bonus+']]</span><br><br> \
                            </b> \
                        </div>'
                        makeAndSendMenu(contents, token.get('name') + ' Initiative', whisper);                        
                    }    
                }  else if(state[state_name].config.turnorder.show_initiative_roll) { 
                    let contents = ' \
                    <table style="width: 100%; text-align: left;"> \
                        <tr> \
                            <th>Modifier</th> \
                            <td>'+bonus+'</td> \
                        </tr> \
                    </table> \
                    <div style="text-align: center"> \
                        <b style="font-size: 16pt;"> \
                            <span style="border: 1px solid green; padding-bottom: 2px; padding-top: 4px;">[['+rollInit+'+'+bonus+']]</span><br><br> \
                        </b> \
                    </div>'
                    makeAndSendMenu(contents, token.get('name') + ' Initiative', whisper);
                }   
                addToTurnorder({ id: token.get('id'), pr: rollInit+bonus, custom: '', pageid: token.get('pageid') });
            }   
            
        });

        if(sort){
            sortTurnorder();
        }
    },

    stopCombat = () => {
        if(timerObj) timerObj.remove();
        removeMarkers();
        stopTimer();
        paused = false;
        Campaign().set({
            initiativepage: false,
            turnorder: ''
        });
        state[state_name].turnorder = {};
        round = 1;
    },

    clearTurnorder = () => {
        Campaign().set({ turnorder: '' });
        state[state_name].turnorder = {};
    },

    removeMarkers = () => {
        stopRotate();
        getOrCreateMarker().remove();
        getOrCreateMarker(true).remove();
    },

    resetMarker = (next=false) => {
        let marker = getOrCreateMarker(next);
        marker.set({
            name: (next) ? 'NextMarker' : 'Round ' + round,
            imgsrc: (next) ? state[state_name].config.next_marker_img : state[state_name].config.marker_img,
            pageid: Campaign().get('playerpageid'),
            layer: 'gmlayer',
            left: 35, top: 35,
            width: 70, height: 70
        });

        return marker;
    },

    doTurnorderChange = (prev=false) => {
        if(!Campaign().get('initiativepage') || getTurnorder().length <= 1) return;

        let turn = getCurrentTurn();

        if(turn.id === '-1'){ // If custom item.
            if(turn.formula){
                updatePR(turn, parseInt(turn.formula));
            }

            if(!state[state_name].config.turnorder.skip_custom) resetMarker();
            else NextTurn();
            return;
        }
        if(turn.id === getOrCreateMarker().get('id')){
            if(prev) PrevRound();
            else NextRound();
            return;
        }

        let token = getObj('graphic', turn.id);

		if(token){
            toFront(token);

            if(state[state_name].config.timer.use_timer){
                startTimer(token);
            }

            changeMarker(token || false);

            if(state[state_name].config.macro.run_macro){
                let ability = findObjs({ _characterid: token.get('represents'), _type: 'ability', name: state[state_name].config.macro.macro_name })
                if(ability && ability.length){
                    sendChat(token.get('name'), ability[0].get('action'), null, {noarchive:true} );
                }
            }

            if(state[state_name].config.announcements.announce_turn){
                announceTurn(token || turn.custom, (token.get('layer') === 'objects') ? '' : 'gm');
            }else if(state[state_name].config.announcements.announce_conditions){
                let name = token.get('name') || turn.custom;
                let conditions = getConditionString(token);
                if(conditions && conditions !== '') makeAndSendMenu(conditions, 'Conditions - ' + name, (token.get('layer') === 'objects') ? '' : 'gm');
            }

            Pull(token);
            doFX(token);
        }else{
            resetMarker();
        }

        if(state[state_name].config.next_marker){
            let nextTurn = getNextTurn();
            let nextToken = getObj('graphic', nextTurn.id);

            if(nextToken){
                toFront(nextToken);

                changeMarker(nextToken || false, true);
            }else{
                resetMarker(true);
            }
        }
    },

    updatePR = (turn, modifier) => {
        let turnorder = getTurnorder();

        turnorder.forEach((t, i) => {
            if(turn.id === t.id && turn.custom === t.custom){
                turnorder[i].pr = parseInt(t.pr) + modifier;
            }
        });

        setTurnorder(turnorder);
    },

    doFX = (token) => {
        if(!state[state_name].config.announcements.use_fx || token.get('layer') === 'gmlayer') return;

        let pos = {x: token.get('left'), y: token.get('top')};
        spawnFxBetweenPoints(pos, pos, state[state_name].config.announcements.fx_type, token.get('pageid'));
    },

    Pull = (token) => {
        if(!state[state_name].config.pull) return;

        sendPing(token.get('left'), token.get('top'), token.get('pageid'), null, true);
    },

    startTimer = (token) => {
        paused = false;
        clearInterval(intervalHandle);
        if(timerObj) timerObj.remove();

        let config_time = parseInt(state[state_name].config.timer.time); 
        let time = config_time;

        if(token && state[state_name].config.timer.token_timer){
            timerObj = createObj('text', {
                text: 'Timer: ' + time,
                font_size: state[state_name].config.timer.token_font_size,
                font_family: state[state_name].config.timer.token_font,
                color: state[state_name].config.timer.token_font_color,
                pageid: token.get('pageid'),
                layer: 'gmlayer'
            });
        }

        intervalHandle = setInterval(() => {
            if(paused) return;

            if(timerObj) timerObj.set({
                top: token.get('top')+token.get('width')/2+40,
                left: token.get('left'),
                text: 'Timer: ' + time,
                layer: token.get('layer')
            });

            if(state[state_name].config.timer.chat_timer && (time === config_time || config_time/2 === time || config_time/4 === time || time === 10 || time === 5)){
                makeAndSendMenu('', 'Time Remaining: ' + time);
            }

            if(time <= 0){
                if(timerObj) timerObj.remove();
                clearInterval(intervalHandle);
                if(state[state_name].config.timer.auto_skip) NextTurn();
                else if(token.get('layer') !== 'gmlayer') makeAndSendMenu(token.get('name') + "'s time ran out!", '');
            }

            time--;
        }, 1000);
    },

    stopTimer = () => {
        clearInterval(intervalHandle);
        if(timerObj) timerObj.remove();
    },

    pauseTimer = () => {
        paused = !paused;
    },

    announceTurn = (token, target) => {
        target = (state[state_name].config.announcements.whisper_turn_gm) ? 'gm' : target;

        let name, imgurl;
        if(typeof token === 'object'){
            name = token.get('name');
            imgurl = token.get('imgsrc');
        }else{
            name = token;
        }

        let conditions = getConditionString(token);

        let image = (imgurl) ? '<img src="'+imgurl+'" width="50px" height="50px"  />' : '';
        name = (state[state_name].config.announcements.handleLongName) ? handleLongString(name) : name;

        let contents = '\
        <table> \
          <tr> \
            <td>'+image+'</td> \
            <td style="padding-left: 5px;"><span style="font-size: 16pt;">'+name+'\'s Turn</span></td> \
          </tr> \
        </table> \
        <div style="overflow: hidden"> \
          <div style="float: left">'+conditions+'</div> \
          ' + makeButton('Done', '!'+state[state_name].config.command+' next', styles.button + styles.float.right) +' \
        </div>';
        makeAndSendMenu(contents, '', target);
    },

   getConditionString = (token) => {
       let name = strip(token.get('id')).toLowerCase();
       let conditionsSTR = '';

       if(state[state_name].conditions[name] && state[state_name].conditions[name].length){
           for(let i = 0; i < state[state_name].conditions[name].length; i++){
               let condition = state[state_name].conditions[name][i];
               if(typeof condition.duration === 'undefined' || condition.duration === false){
                   conditionsSTR += '<strong>'+condition.name+'</strong><br>';
               }else if(condition.duration <= 1 && condition.direction != 0){
                   conditionsSTR += '<strong>'+condition.name+'</strong> removed.<br>';
                   removeCondition(token, condition.name, true);
                   i--;
               } else {
                   state[state_name].conditions[name][i].duration = parseInt(state[state_name].conditions[name][i].duration)+parseInt(condition.direction);
                   conditionsSTR += '<strong>'+condition.name+'</strong>: ' + condition.duration + '<br>';
               }
               conditionsSTR += (condition.message) ? '<em style="font-size: 10pt">'+condition.message+'</em><br>' : '';
           }
       }
       return conditionsSTR;
   },

    handleLongString = (str, max=8) => {
        str = str.split(' ')[0];
        return (str.length > max) ? str.slice(0, max) + '...' : str;
    },

    NextTurn = () => {
        let turnorder = getTurnorder(),
            current_turn = turnorder.shift();

        turnorder.push(current_turn);

        setTurnorder(turnorder);
        doTurnorderChange();
    },

    PrevTurn = () => {
        let turnorder = getTurnorder(),
            last_turn = turnorder.pop();        
        turnorder.unshift(last_turn);

        setTurnorder(turnorder);
        doTurnorderChange(true);
    },

    NextRound = () => {
        let marker = getOrCreateMarker();
        round++;
        marker.set({ name: 'Round ' + round});

        if(state[state_name].config.announcements.announce_round){
            let text = '<span style="font-size: 16pt; font-weight: bold;">'+marker.get('name')+'</span>';
            makeAndSendMenu(text);
        }

        if(state[state_name].config.turnorder.reroll_ini_round){
            let turnorder = getTurnorder();
            clearTurnorder();
            rollInitiative(turnorder.map(t => { return (t.id !== -1 && t.id !== marker.get('id')) ? { _type: 'graphic', _id: t.id } : false }), state[state_name].config.turnorder.auto_sort);
            sortTurnorder();
        }else{
            NextTurn();
        }
    },

    PrevRound = () => {
        let marker = getOrCreateMarker();
        round--;
        marker.set({ name: 'Round ' + round});

        if(state[state_name].config.announcements.announce_round){
            let text = '<span style="font-size: 16pt; font-weight: bold;">'+marker.get('name')+'</span>';
            makeAndSendMenu(text);
        }

        PrevTurn();
    },

    changeMarker = (token, next=false) => {
        let marker = getOrCreateMarker(next);

        if(!token){
            resetMarker(next);
            return;
        }

        let position = {
            top: token.get('top'),
            left: token.get('left'),
            width: token.get('width')+(token.get('width')*0.35),
            height: token.get('height')+(token.get('height')*0.35),
        };

        if(token.get('layer') !== marker.get('layer')){
            if(marker.get('layer') === 'gmlayer'){ // Go from gmlayer to tokenlayer
                marker.set(position);

                setTimeout(() => {
                    marker.set({ layer: 'objects' });
                }, 500);
            }else{ // Go from tokenlayer to gmlayer
                marker.set({ layer: 'gmlayer' });

                setTimeout(() => {
                    marker.set(position);
                }, 500);
            }
        }else{
            marker.set(position);
        }

        toBack(marker);
    },

    getOrCreateMarker = (next=false, pageid=Campaign().get('playerpageid')) => {
        let marker, markers,
            imgsrc = (next) ? state[state_name].config.next_marker_img : state[state_name].config.marker_img

        if(next){
            markers = findObjs({
                pageid,
                imgsrc,
                name: 'NextMarker'
            });

        }else{
            markers = findObjs({
                pageid,
                imgsrc
            });
        }

        markers.forEach((marker, i) => {
            if(i > 0 && !next && marker.get('name') !== 'NextMarker') marker.remove();
        });

        marker = markers.shift();
        if(!marker) {
            marker = createObj('graphic', {
                name: (next) ? 'NextMarker' : 'Round 0',
                imgsrc,
                pageid,
                layer: 'gmlayer',
                showplayers_name: true,
                left: 35, top: 35,
                width: 70, height: 70
            });
        }
        if(!next) checkMarkerturn(marker);
        toBack(marker);

        //marker.set({ layer: 'gmlayer' });

        //startRotate(marker);

        return marker;
    },

/*
    startRotate = (token) => {
        clearInterval(rotationInterval);

        let i = 0;
        rotationInterval = setInterval(() => {
            i += 2;

            log(i);

            if(i >= 360) i = 0;

            token.set('rotation', i);
        }, 50);
    },
*/

    stopRotate = () => {
        clearInterval(rotationInterval);
    },

    checkMarkerturn = (marker) => {
        let turnorder = getTurnorder(),
            hasTurn = false;
        turnorder.forEach(turn => {
            if(turn.id === marker.get('id')) hasTurn = true;
        });

        if(!hasTurn){
            turnorder.push({ id: marker.get('id'), pr: -1, custom: '', pageid: marker.get('pageid') });
            Campaign().set('turnorder', JSON.stringify(turnorder));
        }
    },

    sortTurnorder = (order='DESC') => {
        let turnorder = getTurnorder();

        turnorder.sort((a,b) => { 
            return (order === 'ASC') ? a.pr - b.pr : b.pr - a.pr;
        });

        setTurnorder(turnorder);
        doTurnorderChange();
    },

    getTurnorder = () => {
        return (Campaign().get('turnorder') === '') ? [] : Array.from(JSON.parse(Campaign().get('turnorder')));
    },

    getCurrentTurn = () => {
        return getTurnorder().shift();
    },

    getNextTurn = () => {
        let returnturn;
        getTurnorder().every((turn, i) => {
            if(i > 0 && turn.id !== '-1' && turn.id !== getOrCreateMarker().get('id')){
                returnturn = turn;
                return false;
            }else return true
        });
        return returnturn;
    },

    addToTurnorder = (turn) => {
		if(!turn){
			return;
		}

        let turnorder = getTurnorder(),
            justDoIt = true;
        turnorder.forEach(t => {
            if(t.id === turn.id) justDoIt = false;
        });

        if(justDoIt){
            turnorder.push(turn);
            setTurnorder(turnorder);
        }
    },

    setTurnorder = (turnorder) => {
        Campaign().set('turnorder', JSON.stringify(turnorder));
    },

    randomBetween = (min, max) => {
        return Math.floor(Math.random()*(max-min+1)+min);
    },

    sendTokenConditionMenu = (tokens, toPlayers) => {
        let contents = '<table style="width: 100%;">';

        let i = 0;
        tokens.forEach(token => {
            if(!token) return;

            let conditions = state[state_name].conditions[strip(token.get('id')).toLowerCase()];

            if(i) contents += '<tr><td colspan="2"><hr></td></tr>';
            i++;

            contents += ' \
                <tr> \
                    <td colspan="2" style="font-size: 12pt; font-weight: bold;"> \
                        <img src='+token.get('imgsrc')+' style="width: 32px; height: 32px; vertical-align: middle;" /> \
                        <span style="vertical-align: middle;">'+token.get('name')+'</span> \
                    </td> \
                </tr>';

            if(!conditions || !conditions.length){
                contents += '<tr><td colspan="2" style="text-align: center;"><i>None</i></td></tr>';
            }else{
                conditions.forEach(condition => {
                    let si_condition = false;
                    if(extensions.StatusInfo){
                        si_condition = StatusInfo.getConditionByName(condition.name) || false;
                    }

                    let removeButton = makeButton('<img src="https://s3.amazonaws.com/files.d20.io/images/11381509/YcG-o2Q1-CrwKD_nXh5yAA/thumb.png?1439051579" />', '!'+state[state_name].config.command + ' remove ' + condition.name + ' ' + token.get('id'), styles.button + styles.float.right + 'width: 16px; height: 16px;');
                    let showButton = (condition.message || si_condition) ? makeButton('<img src="https://cdn1.iconfinder.com/data/icons/hawcons/32/699008-icon-22-eye-128.png" />', '!'+state[state_name].config.command + ' showcondition ' + condition.name + ' ' + token.get('id'), styles.button + styles.float.right + 'width: 16px; height: 16px;') : '';
                    let name = condition.name;
                    name += (condition.duration) ? ' (' + condition.duration + ')' : '';
                    contents += ' \
                    <tr> \
                        <td style="text-align: center">'+name+'</td> \
                        <td>'+removeButton+showButton+'</td> \
                    </tr>';
                });
            }
        });

        contents += '</table>';

        makeAndSendMenu(contents, '', (toPlayers) ? '' : 'gm');
    },

    sendConditionsMenu = () => {
        let addButton;

        let SI_listItems = [];
        if(extensions.StatusInfo){
            Object.keys(StatusInfo.getConditions()).map(key => StatusInfo.getConditions()[key]).forEach(condition => {
                let conditionSTR = condition.name + ' ?{Duration} ?{Direction|-1} ?{Message}';
                addButton = makeButton(StatusInfo.getIcon(condition.icon, 'margin-right: 5px; margin-top: 5px; display: inline-block;') + condition.name, '!'+state[state_name].config.command + ' add ' + conditionSTR, styles.textButton);
                SI_listItems.push('<span style="'+styles.float.left+'">'+addButton+'</span>');
            });
        }

        let F_listItems = [];
        Object.keys(state[state_name].favorites).map(key => state[state_name].favorites[key]).forEach(condition => {
            let conditionSTR = (!condition.duration) ? condition.name : condition.name + ' ' + condition.duration + ' ' + condition.direction + ' ' + condition.message;
            addButton = makeButton(condition.name, '!'+state[state_name].config.command + ' add ' + conditionSTR, styles.textButton);
            F_listItems.push('<span style="'+styles.float.left+'">'+addButton+' - <span style="font-size: 8pt">'+condition.duration+':'+condition.direction+':'+condition.message+'</span></span>');
        });

        let contents = '';

        contents += '<h4>StatusInfo Conditions</h4>';
        if(SI_listItems.length){
            contents += makeList(SI_listItems, styles.reset + styles.list + styles.overflow, styles.overflow);
        }else{
            contents += (extensions.StatusInfo) ? 'Your StatusInfo doesn\'t have any conditions.' : makeButton('StatusInfo', 'https://github.com/RobinKuiper/Roll20APIScripts/tree/master/StatusInfo', styles.textButton) + ' is not installed.';
        }

        contents += '<hr>';

        contents += '<h4>Favorite Conditions</h4>';
        if(F_listItems.length){
            contents += makeList(F_listItems, styles.reset + styles.list + styles.overflow, styles.overflow);
        }else{
            contents += 'You don\'t have any favorite conditions yet.';
        }

        contents += '<br><br>' + makeButton('Edit Favorites', '!'+state[state_name].config.command + ' favorites', styles.button + styles.fullWidth);

        makeAndSendMenu(contents, 'Conditions', 'gm');
    },

    sendFavoritesMenu = () => {
        let addButton, editButton, list;

        let listItems = [];
        Object.keys(state[state_name].favorites).map(key => state[state_name].favorites[key]).forEach(condition => {
            let conditionSTR = (!condition.duration) ? condition.name : condition.name + ' ' + condition.duration + ' ' + condition.direction + ' ' + condition.message;
            addButton = makeButton(condition.name, '!'+state[state_name].config.command + ' add ' + conditionSTR, styles.textButton);
            editButton = makeButton('Edit', '!'+state[state_name].config.command + ' editfav ' + condition.name, styles.button + styles.float.right);
            listItems.push('<span style="'+styles.float.left+'">'+addButton+'</span> '+editButton);
        });

        let newButton = makeButton('Add New', '!'+state[state_name].config.command + ' addfav ?{Name} ?{Duration} ?{Direction} ?{Message}', styles.button + styles.fullWidth);

        list = (listItems.length) ? makeList(listItems, styles.reset + styles.list + styles.overflow, styles.overflow) : 'No favorites yet.';

        makeAndSendMenu(list + '<hr>' + newButton, 'Favorite Conditions', 'gm');
    },

    sendEditFavoriteConditionMenu = (condition) => {
        if(!state[state_name].favorites[strip(condition.name).toLowerCase()]){
            makeAndSendMenu('Condition does not exist.', '', 'gm');
            return;
        }

        let nameButton = makeButton(condition.name, '!'+state[state_name].config.command + ' editfav ' + condition.name + ' name|?{Name|'+condition.name+'}', styles.button + styles.float.right);
        let durationButton = makeButton(condition.duration, '!'+state[state_name].config.command + ' editfav ' + condition.name + ' duration|?{Duration|'+condition.duration+'}', styles.button + styles.float.right);
        let directionButton = makeButton(condition.direction, '!'+state[state_name].config.command + ' editfav ' + condition.name + ' direction|?{Direction|'+condition.direction+'}', styles.button + styles.float.right);

        let listItems = [
            '<span style="'+styles.float.left+'">Name</span> '+nameButton,
            '<span style="'+styles.float.left+'">Duration</span> '+durationButton
        ];

        if(condition.duration && condition.duration !== 0 && condition.duration !== '0'){
            listItems.push('<span style="'+styles.float.left+'">Direction</span> '+directionButton);
        }

        let removeButton = makeButton('Remove', '!'+state[state_name].config.command + ' removefav ' + condition.name, styles.button + styles.fullWidth);
        let backButton = makeButton('Back', '!'+state[state_name].config.command + ' favorites', styles.button + styles.fullWidth);
        let messageButton = makeButton((condition.message) ? 'Change Message' : 'Set Message', '!'+state[state_name].config.command + ' editfav ' + condition.name + ' message|?{Message|'+condition.message+'}', styles.button);

        let message = (condition.message) ? condition.message : '<i>None</i>';

        makeAndSendMenu(makeList(listItems, styles.reset + styles.list + styles.overflow, styles.overflow) + '<hr><b>Message</b><p>' + message + '</p>' + messageButton + '<hr>' + removeButton + '<hr>' + backButton, 'Edit - ' + condition.name, 'gm');
    },

    sendConfigMenu = (first, message) => {
        let commandButton = makeButton('!'+state[state_name].config.command, '!' + state[state_name].config.command + ' config command|?{Command (without !)}', styles.button + styles.float.right),
            markerImgButton = makeButton('<img src="'+state[state_name].config.marker_img+'" width="30px" height="30px" />', '!' + state[state_name].config.command + ' config marker_img|?{Image Url}', styles.button + styles.float.right),
            nextMarkerButton = makeButton(state[state_name].config.next_marker, '!' + state[state_name].config.command + ' config next_marker|'+!state[state_name].config.next_marker, styles.button + styles.float.right),
            nextMarkerImgButton = makeButton('<img src="'+state[state_name].config.next_marker_img+'" width="30px" height="30px" />', '!' + state[state_name].config.command + ' config next_marker_img|?{Image Url}', styles.button + styles.float.right),
            iniAttrButton = makeButton(state[state_name].config.initiative_attribute_name, '!' + state[state_name].config.command + ' config initiative_attribute_name|?{Attribute|'+state[state_name].config.initiative_attribute_name+'}', styles.button + styles.float.right),
            closeStopButton = makeButton(state[state_name].config.close_stop, '!' + state[state_name].config.command + ' config close_stop|'+!state[state_name].config.close_stop, styles.button + styles.float.right),
            pullButton = makeButton(state[state_name].config.pull, '!' + state[state_name].config.command + ' config pull|'+!state[state_name].config.pull, styles.button + styles.float.right),
            
            listItems = [
                '<span style="'+styles.float.left+'">Command:</span> ' + commandButton,
                '<span style="'+styles.float.left+'">Ini. Attribute:</span> ' + iniAttrButton,
                '<span style="'+styles.float.left+'">Marker Img:</span> ' + markerImgButton,
                '<span style="'+styles.float.left+'">Use Next Marker:</span> ' + nextMarkerButton,
                '<span style="'+styles.float.left+'">Next Marker Img:</span> ' + nextMarkerImgButton,
                '<span style="'+styles.float.left+'">Stop on close:</span> ' + closeStopButton,
                '<span style="'+styles.float.left+'">Auto Pull Map:</span> ' + pullButton,
            ],

            configTurnorderButton = makeButton('Turnorder Config', '!'+state[state_name].config.command + ' config turnorder', styles.button),
            configTimerButton = makeButton('Timer Config', '!'+state[state_name].config.command + ' config timer', styles.button),
            configAnnouncementsButton = makeButton('Announcement Config', '!'+state[state_name].config.command + ' config announcements', styles.button),
            configMacroButton = makeButton('Macro Config', '!'+state[state_name].config.command + ' config macro', styles.button),
            resetButton = makeButton('Reset', '!' + state[state_name].config.command + ' reset', styles.button + styles.fullWidth),

            title_text = (first) ? script_name + ' First Time Setup' : script_name + ' Config';

        message = (message) ? '<p>'+message+'</p>' : '';
        let contents = message+makeList(listItems, styles.reset + styles.list + styles.overflow, styles.overflow)+configTurnorderButton+'<br>'+configTimerButton+'<br>'+configAnnouncementsButton+'<br>'+configMacroButton+'<hr><p style="font-size: 80%">You can always come back to this config by typing `!'+state[state_name].config.command+' config`.</p><hr>'+resetButton;
        makeAndSendMenu(contents, title_text, 'gm');
    },

    sendConfigTurnorderMenu = () => {
        let throwIniButton = makeButton(state[state_name].config.turnorder.throw_initiative, '!' + state[state_name].config.command + ' config turnorder throw_initiative|'+!state[state_name].config.turnorder.throw_initiative, styles.button + styles.float.right),
            iniDieButton = makeButton('d' + state[state_name].config.turnorder.ini_die, '!' + state[state_name].config.command + ' config turnorder ini_die|?{Die (without the d)|'+state[state_name].config.turnorder.ini_die+'}', styles.button + styles.float.right),
            showRollButton = makeButton(state[state_name].config.turnorder.show_initiative_roll, '!' + state[state_name].config.command + ' config turnorder show_initiative_roll|'+!state[state_name].config.turnorder.show_initiative_roll, styles.button + styles.float.right),
            autoSortButton = makeButton(state[state_name].config.turnorder.auto_sort, '!' + state[state_name].config.command + ' config turnorder auto_sort|'+!state[state_name].config.turnorder.auto_sort, styles.button + styles.float.right),
            rerollIniButton = makeButton(state[state_name].config.turnorder.reroll_ini_round, '!' + state[state_name].config.command + ' config turnorder reroll_ini_round|'+!state[state_name].config.turnorder.reroll_ini_round, styles.button + styles.float.right),
            skipCustomButton = makeButton(state[state_name].config.turnorder.skip_custom, '!' + state[state_name].config.command + ' config turnorder skip_custom|'+!state[state_name].config.turnorder.skip_custom, styles.button + styles.float.right),

            backButton = makeButton('< Back', '!'+state[state_name].config.command + ' config', styles.button + styles.fullWidth),

            listItems = [
                '<span style="'+styles.float.left+'">Auto Roll Ini.:</span> ' + throwIniButton,
                '<span style="'+styles.float.left+'">Reroll Ini. p. Round:</span> ' + rerollIniButton,
                '<span style="'+styles.float.left+'">Auto Sort:</span> ' + autoSortButton,
                '<span style="'+styles.float.left+'">Skip Custom Item:</span> ' + skipCustomButton
            ];

            if(state[state_name].config.turnorder.throw_initiative){
                listItems.push('<span style="'+styles.float.left+'">Ini Die:</span> ' + iniDieButton);
            }

            if(state[state_name].config.turnorder.throw_initiative){
                listItems.push('<span style="'+styles.float.left+'">Show Initiative:</span> ' + showRollButton);
            }

        let contents = makeList(listItems, styles.reset + styles.list + styles.overflow, styles.overflow)+'<hr>'+backButton;
        makeAndSendMenu(contents, script_name + ' Turnorder Config', 'gm');
    },

    sendConfigAnnounceMenu = () =>{
        let announceTurnButton = makeButton(state[state_name].config.announcements.announce_turn, '!' + state[state_name].config.command + ' config announcements announce_turn|'+!state[state_name].config.announcements.announce_turn, styles.button + styles.float.right),
            announceRoundButton = makeButton(state[state_name].config.announcements.announce_round, '!' + state[state_name].config.command + ' config announcements announce_round|'+!state[state_name].config.announcements.announce_round, styles.button + styles.float.right),
            announceConditionsButton = makeButton(state[state_name].config.announcements.announce_conditions, '!' + state[state_name].config.command + ' config announcements announce_conditions|'+!state[state_name].config.announcements.announce_conditions, styles.button + styles.float.right),
            handleLongNameButton = makeButton(state[state_name].config.announcements.handleLongName, '!' + state[state_name].config.command + ' config announcements handleLongName|'+!state[state_name].config.announcements.handleLongName, styles.button + styles.float.right),
            useFXButton = makeButton(state[state_name].config.announcements.use_fx, '!' + state[state_name].config.command + ' config announcements use_fx|'+!state[state_name].config.announcements.use_fx, styles.button + styles.float.right),
            FXTypeButton = makeButton(state[state_name].config.announcements.fx_type, '!' + state[state_name].config.command + ' config announcements fx_type|?{Type|'+state[state_name].config.announcements.fx_type+'}', styles.button + styles.float.right),
            whisperTurnGMButton = makeButton(state[state_name].config.announcements.whisper_turn_gm, '!' + state[state_name].config.command + ' config announcements whisper_turn_gm|'+!state[state_name].config.announcements.whisper_turn_gm, styles.button + styles.float.right),

            backButton = makeButton('< Back', '!'+state[state_name].config.command + ' config', styles.button + styles.fullWidth),

            listItems = [];

        listItems.push('<span style="'+styles.float.left+'">Announce Round:</span> ' + announceRoundButton);
        listItems.push('<span style="'+styles.float.left+'">Announce Turn:</span> ' + announceTurnButton);
    
        if(!state[state_name].config.announcements.announce_turn){
            listItems.push('<span style="'+styles.float.left+'">Announce Conditions:</span> ' + announceConditionsButton);
        }
        if(state[state_name].config.announcements.announce_turn){
            listItems.push('<span style="'+styles.float.left+'">Whisper GM Only:</span> ' + whisperTurnGMButton);
            listItems.push('<span style="'+styles.float.left+'">Shorten Long Name:</span> ' + handleLongNameButton);
        }

        listItems.push('<span style="'+styles.float.left+'">Use FX:</span> ' + useFXButton);

        if(state[state_name].config.announcements.use_fx){
            listItems.push('<span style="'+styles.float.left+'">FX Type:</span> ' + FXTypeButton);
        }

        let contents = makeList(listItems, styles.reset + styles.list + styles.overflow, styles.overflow)+'<hr>'+backButton;
        makeAndSendMenu(contents, script_name + ' Announcements Config', 'gm');
    },

    sendConfigTimerMenu = () => {
        let turnTimerButton = makeButton(state[state_name].config.timer.use_timer, '!' + state[state_name].config.command + ' config timer use_timer|'+!state[state_name].config.timer.use_timer, styles.button + styles.float.right),
            timeButton = makeButton(state[state_name].config.timer.time, '!' + state[state_name].config.command + ' config timer time|?{Time|'+state[state_name].config.timer.time+'}', styles.button + styles.float.right),
            autoSkipButton = makeButton(state[state_name].config.timer.auto_skip, '!' + state[state_name].config.command + ' config timer auto_skip|'+!state[state_name].config.timer.auto_skip, styles.button + styles.float.right),
            chatTimerButton = makeButton(state[state_name].config.timer.chat_timer, '!' + state[state_name].config.command + ' config timer chat_timer|'+!state[state_name].config.timer.chat_timer, styles.button + styles.float.right),
            tokenTimerButton = makeButton(state[state_name].config.timer.token_timer, '!' + state[state_name].config.command + ' config timer token_timer|'+!state[state_name].config.timer.token_timer, styles.button + styles.float.right),
            tokenFontButton = makeButton(state[state_name].config.timer.token_font, '!' + state[state_name].config.command + ' config timer token_font|?{Font|Arial|Patrick Hand|Contrail|Light|Candal}', styles.button + styles.float.right),
            tokenFontSizeButton = makeButton(state[state_name].config.timer.token_font_size, '!' + state[state_name].config.command + ' config timer token_font_size|?{Font Size|'+state[state_name].config.timer.token_font_size+'}', styles.button + styles.float.right),

            backButton = makeButton('< Back', '!'+state[state_name].config.command + ' config', styles.button + styles.fullWidth),

            listItems = [
                '<span style="'+styles.float.left+'">Turn Timer:</span> ' + turnTimerButton,
                '<span style="'+styles.float.left+'">Time:</span> ' + timeButton,
                '<span style="'+styles.float.left+'">Auto Skip:</span> ' + autoSkipButton,
                '<span style="'+styles.float.left+'">Show in Chat:</span> ' + chatTimerButton,
                '<span style="'+styles.float.left+'">Show on Token:</span> ' + tokenTimerButton,
                '<span style="'+styles.float.left+'">Token Font:</span> ' + tokenFontButton,
                '<span style="'+styles.float.left+'">Token Font Size:</span> ' + tokenFontSizeButton
            ];

        let contents = makeList(listItems, styles.reset + styles.list + styles.overflow, styles.overflow)+'<hr>'+backButton;
        makeAndSendMenu(contents, script_name + ' Timer Config', 'gm');
    },

    sendConfigMacroMenu = () => {
        let runMacroButton = makeButton(state[state_name].config.macro.run_macro, '!' + state[state_name].config.command + ' config macro run_macro|'+!state[state_name].config.macro.run_macro, styles.button + styles.float.right),
            macroNameButton = makeButton(state[state_name].config.macro.macro_name, '!' + state[state_name].config.command + ' config macro macro_name|?{Macro Name|'+state[state_name].config.macro.macro_name+'}', styles.button + styles.float.right),

            backButton = makeButton('< Back', '!'+state[state_name].config.command + ' config', styles.button + styles.fullWidth),

            listItems = [
                '<span style="'+styles.float.left+'">Run Macro:</span> ' + runMacroButton,
                '<span style="'+styles.float.left+'">Macro Name:</span> ' + macroNameButton,
            ];

        let contents = '<p>A macro with the right name should be in the characters ability list.</p>'+makeList(listItems, styles.reset + styles.list + styles.overflow, styles.overflow)+'<hr>'+backButton;
        makeAndSendMenu(contents, script_name + ' Macro Config', 'gm');
    },

    sendMenu = () => {
        let nextButton = makeButton('Next Turn', '!' + state[state_name].config.command + ' next b', styles.button),
            prevButton = makeButton('Prev. Turn', '!' + state[state_name].config.command + ' prev b', styles.button),
            startCombatButton = makeButton('Start Combat', '!' + state[state_name].config.command + ' start b', styles.button),
            stopCombatButton = makeButton('Stop Combat', '!' + state[state_name].config.command + ' stop b', styles.button),
            pauseTimerTitle = (paused) ? 'Start Timer' : 'Pause Timer',
            pauseTimerButton = makeButton(pauseTimerTitle, '!' + state[state_name].config.command + ' pt b', styles.button),
            stopTimerButton = makeButton('Stop Timer', '!' + state[state_name].config.command + ' st b', styles.button),
            addConditionButton = makeButton('Add Condition', '!' + state[state_name].config.command + ' add ?{Condition} ?{Duration}', styles.button),
            removeConditionButton = makeButton('Remove Condition', '!' + state[state_name].config.command + ' remove ?{Condition}', styles.button),
            resetConditionsButton = makeButton('Reset Conditions', '!'+state[state_name].config.command + ' reset conditions', styles.button),
            favoritesButton = makeButton('Favorite Conditions', '!'+state[state_name].config.command + ' favorites', styles.button),
            contents;
        
        if(inFight()){
            contents = ' \
            '+nextButton+prevButton+'<br> \
            '+pauseTimerButton+stopTimerButton+' \
            <hr> \
            <b>With Selected:</b><br> \
            '+addConditionButton+'<br> \
            '+removeConditionButton+' \
            <hr> \
            '+favoritesButton+' \
            <hr> \
            '+stopCombatButton+'<br> \
            '+resetConditionsButton;
        }else{
            contents = ' \
            '+startCombatButton+' \
            <hr> \
            '+favoritesButton;
        }

        makeAndSendMenu(contents, script_name + ' Menu', 'gm');
    },

    sendHelpMenu = () => {
        let configButton = makeButton('Config', '!' + state[state_name].config.command + ' config', styles.button + styles.fullWidth);

        let listItems = [
            '<span style="'+styles.underline+'">!'+state[state_name].config.command+' help</span> - Shows this menu.',
            '<span style="'+styles.underline+'">!'+state[state_name].config.command+' config</span> - Shows the configuration menu.'
        ];

        let contents = '<b>Commands:</b>'+makeList(listItems, styles.reset + styles.list)+'<hr>'+configButton;
        makeAndSendMenu(contents, script_name + ' Help', 'gm');
    },

    makeAndSendMenu = (contents, title, whisper) => {
        title = (title && title != '') ? makeTitle(title) : '';
        whisper = (whisper && whisper !== '') ? '/w ' + whisper + ' ' : '';
        sendChat(script_name, whisper + '<div style="'+styles.menu+styles.overflow+'">'+title+contents+'</div>', null, {noarchive:true});
    },

    makeTitle = (title) => {
        return '<h3 style="margin-bottom: 10px;">'+title+'</h3>';
    },

    makeButton = (title, href, style) => {
        return '<a style="'+style+'" href="'+href+'">'+title+'</a>';
    },

    makeList = (items, listStyle, itemStyle) => {
        let list = '<ul style="'+listStyle+'">';
        items.forEach((item) => {
            list += '<li style="'+itemStyle+'">'+item+'</li>';
        });
        list += '</ul>';
        return list;
    },

    checkStatusInfo = () => {
        if(typeof StatusInfo === 'undefined'){
            makeAndSendMenu('Consider installing '+makeButton('StatusInfo', 'https://github.com/RobinKuiper/Roll20APIScripts/tree/master/StatusInfo', styles.textButton)+' it works great with this script.', '', 'gm');
            return;
        }


        extensions.StatusInfo = true;
    },

    checkInstall = () => {
        if(!_.has(state, state_name)){
            state[state_name] = state[state_name] || {};
        }
        setDefaults();
        checkStatusInfo();

        log(script_name + ' Ready! Command: !'+state[state_name].config.command);
        if(state[state_name].config.debug){
			makeAndSendMenu(script_name + ' Ready! Debug On.', '', 'gm');
        }
    },

    handeIniativePageChange = (obj,prev) => {
        if(state[state_name].config.close_stop && (obj.get('initiativepage') !== prev.initiativepage && !obj.get('initiativepage'))){
            stopCombat();
        }
    },

    observeTokenChange = function(handler){
        if(handler && _.isFunction(handler)){
            observers.tokenChange.push(handler);
        }
    },

    notifyObservers = function(event,obj,prev){
        _.each(observers[event],function(handler){
            handler(obj,prev);
        });
    },

    registerEventHandlers = () => {
        on('chat:message', handleInput);
        on('change:campaign:turnorder', handleTurnorderChange);
        on('change:campaign:initiativepage', handeIniativePageChange);
        on('change:graphic:top', handleGraphicMovement);
        on('change:graphic:left', handleGraphicMovement);
        on('change:graphic:layer', handleGraphicMovement);
        on('change:graphic:statusmarkers', handleStatusMarkerChange);

        if('undefined' !== typeof TokenMod && TokenMod.ObserveTokenChange){
            TokenMod.ObserveTokenChange(function(obj,prev){
                handleStatusMarkerChange(obj,prev);
            });
        }
    },

    setDefaults = (reset) => {
        const defaults = {
            config: {
                command: 'ct',
                marker_img: 'https://s3.amazonaws.com/files.d20.io/images/52550079/U-3U950B3wk_KRtspSPyuw/thumb.png?1524507826',
                next_marker: false,
                next_marker_img: 'https://s3.amazonaws.com/files.d20.io/images/66352183/90UOrT-_Odg2WvvLbKOthw/thumb.png?1541422636',
                initiative_attribute_name: 'initiative_bonus',
                close_stop: true,
                pull: true,
                turnorder: {
                    throw_initiative: true,
                    ini_die: 20,
                    show_initiative_roll: false,
                    auto_sort: true,
                    reroll_ini_round: false,
                    skip_custom: true,
                },
                timer: {
                    use_timer: true,
                    time: 120,
                    auto_skip: true,
                    chat_timer: true,
                    token_timer: true,
                    token_font: 'Candal',
                    token_font_size: 16,
                    token_font_color: 'rgb(255, 0, 0)'
                },
                announcements: {
                    announce_conditions: false,
                    announce_turn: true,
                    whisper_turn_gm: false,
                    announce_round: true,
                    handleLongName: true,
                    use_fx: false,
                    fx_type: 'nova-holy'
                },
                macro: {
                    run_macro: true,
                    macro_name: 'CT_TURN'
                }
            },
            conditions: {},
            favorites: {}
        };

        if(!state[state_name].config){
            state[state_name].config = defaults.config;
        }else{
            if(!state[state_name].config.hasOwnProperty('command')){
                state[state_name].config.command = defaults.config.command;
            }
            if(!state[state_name].config.hasOwnProperty('marker_img')){
                state[state_name].config.marker_img = defaults.config.marker_img;
            }
            if(!state[state_name].config.hasOwnProperty('next_marker')){
                state[state_name].config.next_marker = defaults.config.next_marker;
            }
            if(!state[state_name].config.hasOwnProperty('next_marker_img')){
                state[state_name].config.next_marker_img = defaults.config.next_marker_img;
            }
            if(!state[state_name].config.hasOwnProperty('initiative_attribute_name')){
                state[state_name].config.initiative_attribute_name = defaults.config.initiative_attribute_name;
            }
            if(!state[state_name].config.hasOwnProperty('close_stop')){
                state[state_name].config.close_stop = defaults.config.close_stop;
            }
            if(!state[state_name].config.hasOwnProperty('pull')){
                state[state_name].config.pull = defaults.config.pull;
            }
            if(!state[state_name].config.hasOwnProperty('turnorder')){
                state[state_name].config.turnorder = defaults.config.turnorder;
            }else{
                if(!state[state_name].config.turnorder.hasOwnProperty('skip_custom')){
                    state[state_name].config.turnorder.skip_custom = defaults.config.turnorder.skip_custom;
                }
                if(!state[state_name].config.turnorder.hasOwnProperty('throw_initiative')){
                    state[state_name].config.turnorder.throw_initiative = defaults.config.turnorder.throw_initiative;
                }
                if(!state[state_name].config.turnorder.hasOwnProperty('ini_die')){
                    state[state_name].config.turnorder.ini_die = defaults.config.turnorder.ini_die;
                }
                if(!state[state_name].config.turnorder.hasOwnProperty('auto_sort')){
                    state[state_name].config.turnorder.auto_sort = defaults.config.turnorder.auto_sort;
                }
                if(!state[state_name].config.hasOwnProperty('reroll_ini_round')){
                    state[state_name].config.turnorder.reroll_ini_round = defaults.config.turnorder.reroll_ini_round;
                }
            }
            if(!state[state_name].config.hasOwnProperty('timer')){
                state[state_name].config.timer = defaults.config.timer;
            }else{
                if(!state[state_name].config.timer.hasOwnProperty('use_timer')){
                    state[state_name].config.timer.use_timer = defaults.config.timer.use_timer;
                }
                if(!state[state_name].config.timer.hasOwnProperty('time')){
                    state[state_name].config.timer.time = defaults.config.timer.time;
                }
                if(!state[state_name].config.timer.hasOwnProperty('auto_skip')){
                    state[state_name].config.timer.auto_skip = defaults.config.timer.auto_skip;
                }
                if(!state[state_name].config.timer.hasOwnProperty('chat_timer')){
                    state[state_name].config.timer.chat_timer = defaults.config.timer.chat_timer;
                }
                if(!state[state_name].config.timer.hasOwnProperty('token_timer')){
                    state[state_name].config.timer.token_timer = defaults.config.timer.token_timer;
                }
                if(!state[state_name].config.timer.hasOwnProperty('token_font')){
                    state[state_name].config.timer.token_font = defaults.config.timer.token_font;
                }
                if(!state[state_name].config.timer.hasOwnProperty('token_font_size')){
                    state[state_name].config.timer.token_font_size = defaults.config.timer.token_font_size;
                }
                if(!state[state_name].config.timer.hasOwnProperty('token_font_color')){
                    state[state_name].config.timer.token_font_color = defaults.config.timer.token_font_color;
                }
            }
            if(!state[state_name].config.hasOwnProperty('announcements')){
                state[state_name].config.announcements = defaults.config.announcements;
            }else{
                if(!state[state_name].config.announcements.hasOwnProperty('announce_turn')){
                    state[state_name].config.announcements.announce_turn = defaults.config.announcements.announce_turn;
                }
                if(!state[state_name].config.announcements.hasOwnProperty('whisper_turn_gm')){
                    state[state_name].config.announcements.whisper_turn_gm = defaults.config.announcements.whisper_turn_gm;
                }
                if(!state[state_name].config.announcements.hasOwnProperty('announce_round')){
                    state[state_name].config.announcements.announce_round = defaults.config.announcements.announce_round;
                }
                if(!state[state_name].config.announcements.hasOwnProperty('announce_conditions')){
                    state[state_name].config.announcements.announce_conditions = defaults.config.announcements.announce_conditions;
                }
                if(!state[state_name].config.announcements.hasOwnProperty('handleLongName')){
                    state[state_name].config.announcements.handleLongName = defaults.config.announcements.handleLongName;
                }
                if(!state[state_name].config.announcements.hasOwnProperty('use_fx')){
                    state[state_name].config.announcements.use_fx = defaults.config.announcements.use_fx;
                }
                if(!state[state_name].config.announcements.hasOwnProperty('fx_type')){
                    state[state_name].config.announcements.fx_type = defaults.config.announcements.fx_type;
                }
            }
            if(!state[state_name].config.hasOwnProperty('macro')){
                state[state_name].config.macro = defaults.config.macro;
            }else{
                if(!state[state_name].config.macro.hasOwnProperty('run_macro')){
                    state[state_name].config.macro.run_macro = defaults.config.macro.run_macro;
                }
                if(!state[state_name].config.macro.hasOwnProperty('macro_name')){
                    state[state_name].config.macro.macro_name = defaults.config.macro.macro_name;
                }
            }
        }

        if(!state[state_name].hasOwnProperty('conditions')){
            state[state_name].conditions = defaults.conditions;
        }

        if(!state[state_name].hasOwnProperty('favorites')){
            state[state_name].favorites = defaults.favorites;
        }

        if(!state[state_name].config.hasOwnProperty('firsttime') && !reset){
            sendConfigMenu(true);
            state[state_name].config.firsttime = false;
        }
    };

    return {
        CheckInstall: checkInstall,
        RegisterEventHandlers: registerEventHandlers,
        ObserveTokenChange: observeTokenChange
    };
})();

on('ready',function() {
    'use strict';

    CombatTracker.CheckInstall();
    CombatTracker.RegisterEventHandlers();
});

/*
conditions = {
    54235346534564: [
        { name: 'prone', duration: '1' }
    ]
}
*/
