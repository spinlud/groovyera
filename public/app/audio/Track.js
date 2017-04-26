/*
 * ---------------------------------------------------------------------------------------
 * Track.js
 * ---------------------------------------------------------------------------------------
 */

 "use strict";

 import { Tick } from "./Tick";
import { guid } from "../utils/utils";


 export class Track {

     constructor (drumMachine, name = "track_default", buffer = undefined, volume = 1.0, pan = 0, mute = false ) {
         this.id = guid();
         this.drumMachine = drumMachine;
         this.audioContext = drumMachine.audioContext;
         this.name = name;
         this.buffer = buffer;
         this.solo = false;
         this.mute = mute;
         this.ticks = [];
         this.pannerNodeSupported = false;
         this.gainNode = this.audioContext.createGain();
         this.gainNode.gain.value = volume;


         if (typeof this.audioContext.createStereoPanner === "function") {
             this.pannerNode = this.audioContext.createStereoPanner();
             this.pannerNode.pan.value = pan;
             this.gainNode.connect(this.pannerNode);
             this.pannerNode.connect(this.audioContext.destination);
             this.pannerNodeSupported = true;
             console.log("Stereo panner supported");
         } else {
             this.gainNode.connect(this.audioContext.destination);
             console.log("Stereo panner not supported");
         }

         this._initTicks();
     }


     // setGain(val) {
     //     this.gainNode.gain.value = val > 1 ? 1.0 : val;
     // }


     // setPan(val) {
     //     if (val < -1) {
     //         this.pannerNode.pan.value = -1;
     //     }
     //     else if (val > 1) {
     //         this.pannerNode.pan.value = 1;
     //     }
     //     else {
     //         this.pannerNode.pan.value = val;
     //     }
     // }



     /*
      *
      */
     _initTicks() {
         this.ticks = [];
         for (let i = 0; i < 16; ++i) {
             this.ticks.push(new Tick(i));
         }
     }


     setTick(index, active = true, volume = 1.0) {
         if (index < 0 || index > 15) {
             return;
         }

         this.ticks[index].volume = volume;
         this.ticks[index].active = active;
     }


     setTicksFromArray(data) {
         data.forEach(e => {

             if (typeof e === "object") {
                 if (!e.index || e.index < 0 || e.index > 15) {
                     return;
                 }

                 let tick = this.ticks[e.index];
                 tick.volume = e.volume ? e.volume : 1.0;
                 tick.active = e.active ? e.active : true;
             }
             else {
                 this.ticks[e].active = true;
             }

         });
     }


     setBuffer(buffer, fileName) {
         this.buffer = buffer;
         console.log("Track " + this.name + ": audio buffer changed ( " + fileName + " )");
     }


     playSound() {
         if (!this.audioContext) return;
         let sound = this.audioContext.createBufferSource();
         sound.buffer = this.buffer;
         sound.connect(this.audioContext.destination);
         sound.start();
     }






 }