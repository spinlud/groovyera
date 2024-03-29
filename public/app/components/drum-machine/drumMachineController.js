/**
 * ---------------------------------------------------------------------------------------
 * mainController.js
 * ---------------------------------------------------------------------------------------
 */


import { DrumMachine } from "../../audio/DrumMachine";
import { audioLoader } from "../../audio/audio-loader";
import { groovyRockPreset } from "../../audio/presets";

export function drumMachineController($scope, $compile, $http, $interval, serverBaseURL, FileSaver, Blob, socketEvents) {

    let drumMachine = new DrumMachine();
    let loadingContainer = $("#loadingContainer");
    let commentsLoadingOverlay = $("#commentsLoadingOverlay");
    let commentsLoadingSpinner = $("#commentsLoadingSpinner");
    let playBtn = $("#sequencerPlayButton");
    let stopBtn = $("#sequencerStopButton");
    let bpmSlider = $("#sequencerBPMslider");

    $scope.safeApply = function(fn) {
        var phase = this.$root.$$phase;
        if(phase == '$apply' || phase == '$digest') {
            if(fn && (typeof(fn) === 'function')) {
                fn();
            }
        } else {
            this.$apply(fn);
        }
    };

    $scope.title = "Main Controller";
    $scope.tracks = [];
    $scope.ticksElements = [];
    $scope.audioContext = drumMachine.audioContext;
    $scope.bpm = drumMachine.bpm;
    $scope.isPlaying = drumMachine.isPlaying;
    $scope.isStopped = drumMachine.isStopped;
    $scope.removeTrack = removeTrack;
    $scope.integerval = /^\d*$/;
    $scope.beats = new Array(drumMachine.numberOfBeats).fill(false);
    $scope.samplesData = {};
    $scope.samplesBuffers = {};
    $scope.username = "";
    $scope.commentToPost = "";
    $scope.comments = [];
    $scope.invalidUsernameMessage = "Give ya a name! (3-32 characters)";
    $scope.invalidCommentMessage = "Write something cool! (3-1000 characters)";

    $scope.preset = {
        name: "",
        categorySelected: undefined,
        categories: []
    };


    $scope.tracks = drumMachine.tracks;
    $scope.safeApply();


    /*
     * ---------------------------------------------------------------------------------------
     * UI
     * ---------------------------------------------------------------------------------------
     */

    $( "#accordion" ).accordion({
        animate: 200,
        collapsible: true,
        active: false,
        heightStyle: "content",
        // icons: { "header": "ui-icon-plus", "activeHeader": "ui-icon-minus" },
        beforeActivate: () => {
            if ($scope.comments.length === 0) {
                loadComments();
            }
        }
    });

    $("#postCommentBtn").button({
        icon: "ui-icon-pencil"
    });

    /*
     * ---------------------------------------------------------------------------------------
     * event listeners
     * ---------------------------------------------------------------------------------------
     */

    $(window).ready(() => {

        let beatIndicatorsContainer = document.getElementById("beatIndicators");
        let beatIndicators = beatIndicatorsContainer.getElementsByClassName("beat-indicator");

        function updateBeatIndicators(previousTickIndex, tickIndex) {
            $(beatIndicators[previousTickIndex]).removeClass("beat-indicator-active");
            $(beatIndicators[tickIndex]).addClass("beat-indicator-active");
        }

        drumMachine.addCallBackInLoop(updateBeatIndicators);

    });

    window.addEventListener("keyup", (e) => {
        switch (e.keyCode) {

            //space
            case 32:

                if($('textarea#commentArea, input#usernameInput, input[name="trackName"], input[name="presetName"]').is(":focus")){
                    e.stopPropagation();
                }
                else if ($scope.isStopped) {
                    play(e);
                } else {
                    stop(e);
                }
                break;

            default:
                break;
        }
    });
    window.addEventListener("keydown", (e) => {
        switch (e.keyCode) {

            //space
            case 32:

                if($('textarea#commentArea, input#usernameInput, input[name="trackName"], input[name="presetName"]').is(":focus")){
                    e.stopPropagation();
                } else {
                    e.preventDefault();
                    e.stopPropagation();
                }

                break;

            default:
                break;
        }
    });
    window.addEventListener('keydown', function(e) {
        if(e.keyCode === 32 && e.target === document.body) {
            e.preventDefault();
        }
    }); // remove scroll down on spacebar

    /*
     * ---------------------------------------------------------------------------------------
     * public
     * ---------------------------------------------------------------------------------------
     */

    $scope.enableLoadingSpinner = enableLoadingSpinner;
    $scope.disableLoadingSpinner = disableLoadingSpinner;

    $scope.audioLoader = audioLoader;
    $scope.playSoundFromBuffer = drumMachine.playSoundFromBuffer;

    $scope.startSequencer = () => {
        drumMachine._start();
        $scope.isPlaying = true;
        $scope.isStopped = false;
    };

    $scope.stopSequencer = () => {
        drumMachine._stop();
        $scope.isPlaying = false;
        $scope.isStopped = true;
        let indicators = document.getElementById("beatIndicators").getElementsByClassName("beat-indicator");
        $(indicators).removeClass("beat-indicator-active");
    };

    $scope.addTrack = () => {
        drumMachine.addEmptyTrack();
    };

    $scope.exportMidi = async () => {
        const tracks = [];

        for (let key in drumMachine.tracks) {
            if (drumMachine.tracks.hasOwnProperty(key)) {

                let track = drumMachine.tracks[key];
                let trackData = {
                    name: track.name,
                    notes: []
                };

                let waitCounter = 0;
                track.ticks.forEach((tick) => {

                    if (tick.active) {
                        let noteEventData = {
                            pitch: ["C4"],
                            velocity: tick.volume,
                            duration: "16"  // 1/16
                        };

                        if (waitCounter > 0) {
                            let waitParam = "T" + waitCounter * 32; //number of ticks to wait (each tick is 1/128)
                            noteEventData["wait"] = waitParam;
                        }

                        trackData.notes.push(noteEventData);
                        waitCounter = 0;
                    }

                    else {
                        waitCounter += 1;
                    }
                });

                tracks.push(trackData);
            }
        }

        const data = {
            bpm: drumMachine.bpm,
            timeSignature: {num: 4, den: 4},
            tracks: tracks
        };

        try {
            const response = await $http({
                url: serverBaseURL + "/api/midi",
                method: "POST",
                responseType: "arraybuffer",
                headers: {
                    "Content-Type": "application/json"
                },
                data: JSON.stringify(data)

            });
            const blob = new Blob([response.data], {type: "audio/midi"});
            FileSaver.saveAs(blob, "loop.mid");
        }
        catch (err) {
            console.error(err);
        }
    };

    $scope.populateCategories = () => {
        return new Promise((resolve, reject) => {
            $http({
                url: serverBaseURL + "/api/categories",
                method: "GET",
                headers: {
                    "Accept": "application/json"
                }
            }).then(response => {
                // console.log(response);
                let categories = response.data;
                // categories.forEach(c => {
                //     $scope.categories.push(c.name);
                // });
                $scope.preset.categories = categories;
                resolve(categories);

            }, error => {
                console.log(error);
                reject(error);
            });
        });
    };

    /*
    $scope.loadPreset = () => {

        $http({
            url: serverBaseURL + "/api/presets",
            method: "GET",
            headers: {
                "Accept": "application/json"
            }
        }).then(response => {

            let presets = response.data;
            if (presets.length === 0) {
                return;
            }

            drumMachine.loadPreset(presets[0]).then(tracks => {

                tracks.forEach(t => {
                    drumMachine.tracks[t.id] = t;
                });

                $scope.bpm = drumMachine.bpm;
                bpmSlider.slider("value", $scope.bpm);
                $scope.$apply();


            }, error => {
                console.log(error);
            });

        }, errorResponse => {
            console.log(errorResponse);
        });

    };
    */

    $scope.savePreset = () => {
        const formData = new FormData();
        const jsonPreset = drumMachine.buildJsonPreset($scope.preset.name, $scope.preset.categorySelected.name);
        formData.append("preset", jsonPreset);

        for (const [id, track] of Object.entries(drumMachine.tracks)) {
            let blob = new Blob([track.sampleData.originalBuffer], {
                type: "octet-stream"
            });
            formData.append("sample", blob, track.sampleData.fileName);
        }

        let xhr = new XMLHttpRequest();

        xhr.open( "POST", serverBaseURL + "/api/presets", true );
        xhr.setRequestHeader("Accept", "application/json");
        xhr.onload = () => {
            // created
            if (xhr.status === 200 || xhr.status === 201) {
                toastOk("Preset saved! ;-)");
                $scope.onPresetCancel();
            }
            else if (xhr.status === 409) {
                console.log(xhr.response);
                toastError("Preset name " + $scope.preset.name + " already taken for category "
                    + $scope.preset.categorySelected.name);
            }
            else {
                toastError("Ops! Something went wrong :-(");
                $scope.onPresetCancel();
            }
        };

        xhr.send(formData);
    };

    $scope.postComment = async () => {
        const data = {
            username: $scope.username,
            message: $scope.commentToPost
        };

        try {
            await $http({
                url: serverBaseURL + '/api/comments',
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                data: JSON.stringify(data)

            });
        }
        catch (err) {
            console.error(err);
        }
    };

    $scope.onPresetCancel = () => {
        $(".save-preset-container").remove();
    };

    $scope.onPresetSave = () => {
        $scope.savePreset();
    };

    /*
     * ---------------------------------------------------------------------------------------
     * private
     * ---------------------------------------------------------------------------------------
     */

    function removeTrack(track) {
        drumMachine.removeTrack(track.id);
    }

    function initDefaultTracks($scope, drumMachine) {

        enableLoadingSpinner();

        drumMachine._loadDefaultBuffers().then(() => {
            drumMachine._initDefaultTracks();
            $scope.tracks = drumMachine.tracks;
            $scope.$apply();
            disableLoadingSpinner();
        }, error => {
            console.log(error);
        });
    }

    function initDATgui(drumMachine) {
        let gui = new dat.GUI();
        let bpmController = gui.add(drumMachine, "bpm", 50.0, 220.0);

        bpmController.onChange(value => {
            drumMachine.bpm = Math.floor(drumMachine.bpm);
        });
    }

    function initSequencerControls(scope, drumMachine) {

        playBtn.on("mousedown touchstart", (e) => {

            e.preventDefault();
            e.stopPropagation();

            playBtn.css({
                backgroundColor: "#444"
            });
        });

        playBtn.on("mouseup touchend", (e) => {
            play(e);
        });

        stopBtn.on("mousedown touchstart", (e) => {

            e.preventDefault();
            e.stopPropagation();

            stopBtn.css({
                backgroundColor: "#444"
            });
        });

        stopBtn.on("mouseup touchend", (e) => {
            stop(e);
        });


        bpmSlider.slider({
            min: drumMachine.bpmMin,
            max: drumMachine.bpmMax,
            orientation: "horizontal",
            value: scope.bpm,
            slide: (event, ui) => {
                drumMachine.bpm = ui.value;
                scope.bpm = ui.value;
                scope.$apply();
            }
        }).draggable();



        scope.updateSlider = function() {
            if (drumMachine.isInRangeBPM(scope.bpm)) {
                bpmSlider.slider("value", scope.bpm);
                drumMachine.bpm = scope.bpm;
            }
        }
    }

    function play(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }


        // playBtn.css({
        //     backgroundColor: "transparent",
        //     backgroundImage: "url(./app/assets/icons/Play-50-green.png)"
        // });
        //
        // stopBtn.css({
        //     backgroundColor: "transparent",
        //     backgroundImage: "url(./app/assets/icons/Stop-50-white.png)"
        // });

        stopBtn.removeClass("sequencer-stop-active");
        playBtn.removeClass("sequencer-play-inactive");

        stopBtn.addClass("sequencer-stop-inactive");
        playBtn.addClass("sequencer-play-active");

        playBtn.css({
            backgroundColor: "transparent"
        });

        stopBtn.css({
            backgroundColor: "transparent"
        });

        $scope.startSequencer();
    }

    function stop(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }


        // stopBtn.css({
        //     backgroundColor: "transparent",
        //     backgroundImage: "url(./app/assets/icons/Stop-50-red.png)"
        // });
        //
        // playBtn.css({
        //     backgroundColor: "transparent",
        //     backgroundImage: "url(./app/assets/icons/Play-50-white.png)"
        // });

        playBtn.removeClass("sequencer-play-active");
        stopBtn.removeClass("sequencer-stop-inactive");
        playBtn.addClass("sequencer-play-inactive");
        stopBtn.addClass("sequencer-stop-active");

        playBtn.css({
            backgroundColor: "transparent"
        });

        stopBtn.css({
            backgroundColor: "transparent"
        });

        $scope.stopSequencer();
    }

    function loadPreset(data) {
        window.scrollTo(0, 0);
        enableLoadingSpinner();

        drumMachine.loadPreset(data).then(tracks => {

            tracks.forEach(t => {
                drumMachine.tracks[t.id] = t;
            });

            $scope.bpm = drumMachine.bpm;
            bpmSlider.slider("value", $scope.bpm);
            $scope.preset.name = data.name;
            $("#presetTitle").text($scope.preset.name);
            $scope.safeApply();
            disableLoadingSpinner();

        }, error => {
            console.log(error);
        });
    }

    function initExportMidiMenu() {

        let API = $("nav#menu").data( "mmenu" );
        let li = $('<li><a href="#exportMidi" >Export midi</a></li>');
        li.click($scope.exportMidi);

        $("#menu-list").find( ".mm-listview" ).append( li );

        API.initPanels( $("#menu-list") );

    }

    async function initPresetsMenu(categories) {

        let response;

        try {
            response = await $http({
                url: serverBaseURL + "/api/presets",
                method: "GET",
                headers: {
                    "Accept": "application/json"
                }
            });
        }
        catch (err) {
            console.error(err);
            return;
        }

        const presetsData = response.data;
        if (presetsData.length === 0) return;

        $('li[id="presetsMenu"]').remove();
        let liParent = $('<li id="presetsMenu"><a href="#">Presets</a></li>');
        let ulParent = $("<ul></ul>");
        liParent.append(ulParent);

        categories.forEach(category => {

            const matches = presetsData.filter(p => p.category === category.name);
            if (!matches.length) return;
            let liCategory = $('<li><a href="#">' + category.name + '</a></li>');
            let ul = $("<ul></ul>");

            matches.forEach(preset => {
                let li = $('<li><a href="#">' + preset.name + '</a></li>');
                li.click(() => {
                    loadPreset(preset);
                });

                ul.append(li);
            });

            liCategory.append(ul);
            ulParent.append(liCategory);
        });

        let API = $("nav#menu").data( "mmenu" );
        $("#menu-list").find( ".mm-listview li:first" ).after( liParent );
        API.initPanels( $("#menu-list") );
    }

    function initSavePresetMenu() {
        let li = $('<li><a href="#">Save preset</a></li>');

        li.click(() => {
            let savePreset = angular.element(document.createElement('save-preset'));
            let domElem = $compile(savePreset)($scope);
            angular.element(document.body).append(domElem);
        });

        let API = $("nav#menu").data("mmenu");
        $("#menu-list").find(".mm-listview").append(li);
        API.initPanels($("#menu-list"));
    }

    async function loadComments() {
        enableCommentsLoadingSpinner();
        let response;
        try {
            response = await $http({
                url: serverBaseURL + '/api/comments',
                method: "GET",
                headers: {
                    "Accept" : "application/json"
                }
            });
        }
        catch(err) {
            console.error(err);
            return;
        }

        $scope.comments = response.data;
        $scope.safeApply();
        disableCommentsLoadingSpinner();
    }

    function enableLoadingSpinner() {
        setTimeout(() => {
            window.scrollTo(0, 0);
            loadingContainer.addClass("loading-active");
        }, 0);
    }

    function disableLoadingSpinner() {
        setTimeout(() => {
            window.scrollTo(0, 0);
            loadingContainer.removeClass("loading-active");
        }, 1500);
    }

    function enableCommentsLoadingSpinner() {
        setTimeout(() => {
            commentsLoadingOverlay.addClass("loading-active");
            commentsLoadingSpinner.addClass("loading-active");
        }, 0);
    }

    function disableCommentsLoadingSpinner() {
        setTimeout(() => {
            commentsLoadingOverlay.removeClass("loading-active");
            commentsLoadingSpinner.removeClass("loading-active");
        }, 100);
    }

    function toastError(text) {
        $.toast({
            text : text,
            showHideTransition : 'slide',  // It can be plain, fade or slide
            bgColor : '#ff4a40',              // Background color for toast
            textColor : '#fff',            // text color
            allowToastClose : false,       // Show the close button or not
            hideAfter : 3000,              // `false` to make it sticky or time in miliseconds to hide after
            stack : 5,                     // `fakse` to show one stack at a time count showing the number of toasts that can be shown at once
            textAlign : 'left',            // Alignment of text i.e. left, right, center
            position : 'top-right'       // bottom-left or bottom-right or bottom-center or top-left or top-right or top-center or mid-center or an object representing the left, right, top, bottom values to position the toast on page
        });
    }

    function toastOk(text) {
        $.toast({
            text : text,
            showHideTransition : 'slide',  // It can be plain, fade or slide
            bgColor : '#05a2fc',              // Background color for toast
            textColor : '#fff',            // text color
            allowToastClose : false,       // Show the close button or not
            hideAfter : 3000,              // `false` to make it sticky or time in miliseconds to hide after
            stack : 5,                     // `fakse` to show one stack at a time count showing the number of toasts that can be shown at once
            textAlign : 'left',            // Alignment of text i.e. left, right, center
            position : 'top-right'       // bottom-left or bottom-right or bottom-center or top-left or top-right or top-center or mid-center or an object representing the left, right, top, bottom values to position the toast on page
        });
    }

    /**
     * ---------------------------------------------------------------------------------------
     * init
     * ---------------------------------------------------------------------------------------
     */

    const socket = io.connect(serverBaseURL);
    initSequencerControls($scope, drumMachine);
    loadPreset(groovyRockPreset);
    window.scrollTo(0, 0);

    $(window).ready(() => {
        window.scrollTo(0, 0);
        initSavePresetMenu();
        initExportMidiMenu();

        $scope.populateCategories().then(categories => {
            initPresetsMenu(categories);
        });

        // $interval(() => {
        //     $scope.populateCategories().then(categories => {
        //         console.log("$interval: populateCategories");
        //     })
        // }, 20000);

        socket.on(socketEvents.newPreset, data => {
            console.log(socketEvents.newPreset, data);
            initPresetsMenu($scope.preset.categories);
        });

        socket.on(socketEvents.newComment, comment => {
            // toastOk("Comment posted!");
            $scope.comments.splice(0, 0, comment);
            $scope.commentToPost = "";
            $scope.commentForm.$setPristine();
            $scope.safeApply();
        });
    });
}









