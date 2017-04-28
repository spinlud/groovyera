/*
 * ---------------------------------------------------------------------------------------
 * app.js
 * ---------------------------------------------------------------------------------------
 */


"use strict";


import { initRoutes } from "./routes";

import { drumMachineController } from "./components/drum-machine/drumMachineController";
import { testController } from "./components/test/testController";

import { trackDirective } from "./directives/track-directive";
import { tickSliderDirective } from "./directives/tickSlider-directive";



(function() {

    let app = angular.module("myApp", ["ngRoute", "ngFileSaver"]);


    // configure angular routes
    app.config(["$routeProvider", initRoutes]);


    // bind controllers
    app.controller("drumMachineController", ["$scope", "$http", "FileSaver", "Blob", drumMachineController]);
    app.controller("testController", ['$scope', testController]);


    // register directives
    app.directive("tickSlider", tickSliderDirective);
    app.directive("theTrack", ["supportedAudioFormats", trackDirective]);



    let supportedAudioFormats = new Set();
    supportedAudioFormats.add("audio/wav");
    supportedAudioFormats.add("audio/x-wav");
    supportedAudioFormats.add("audio/mp3");
    supportedAudioFormats.add("audio/x-mp3");
    supportedAudioFormats.add("audio/ogg");
    supportedAudioFormats.add("audio/x-ogg");

    // constants
    app.constant("supportedAudioFormats", supportedAudioFormats);



}());