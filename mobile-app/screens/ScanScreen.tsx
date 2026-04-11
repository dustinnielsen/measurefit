import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { usePlanGating } from '../hooks/usePlanGating';
import { roomsService, scanService } from '../lib/supabase';

const Alert = {
  alert: (title: string, message?: string, buttons?: Array<{ text: string; onPress?: () => void }>) => {
    if (buttons && buttons.length > 1) {
      const result = window.confirm(`${title}\n\n${message ?? ''}`);
      if (result) { buttons[1]?.onPress?.(); } else { buttons[0]?.onPress?.(); }
    } else {
      window.alert(`${title}${message ? '\n\n' + message : ''}`);
      buttons?.[0]?.onPress?.();
    }
  },
};

type ScanStep = 'sticker' | 'mount' | 'scan' | 'review' | 'save';
type MountType = 'inside' | 'outside';
type TapCorner = 'tl' | 'tr' | 'bl' | 'br';

interface Corner { x: number; y: number; }
interface Measurement { widthIn: number; heightIn: number; areaFt: number; }
interface SaveForm {
  roomId: string | null;
  roomName: string;
  windowLabel: string;
  isNewRoom: boolean;
}

const STICKER_SIZE_IN = 2.0;
const MARKER_ID = 35;

export default function ScanScreen({ navigation }: any) {
  const { dealer } = useAuth();
  const { tenantConfig } = useTenant();
  const { tier, isBasic, limits } = usePlanGating();

  const [scanCount, setScanCount] = useState<number>(0);
  const scanLimitReached = isBasic && scanCount >= limits.maxScansPerMonth;

  const [step, setStep] = useState<ScanStep>('sticker');
  const [mountType, setMountType] = useState<MountType>('inside');
  const [overlapLeft, setOverlapLeft] = useState('3.0');
  const [overlapRight, setOverlapRight] = useState('3.0');
  const [overlapTop, setOverlapTop] = useState('3.0');

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [markerDetected, setMarkerDetected] = useState(false);
  const [calibrationLocked, setCalibrationLocked] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [pixelsPerInch, setPixelsPerInch] = useState<number | null>(null);
  const [windowCorners, setWindowCorners] = useState<Partial<Record<TapCorner, Corner>>>({});
  const [tapMode, setTapMode] = useState(false);
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const [arucoLoaded, setArucoLoaded] = useState(false);

  const [rooms, setRooms] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveForm, setSaveForm] = useState<SaveForm>({
    roomId: null, roomName: '', windowLabel: 'Window 1', isNewRoom: false,
  });

  const streamRef = useRef<any>(null);
  const rafRef = useRef<any>(null);
  const detectorRef = useRef<any>(null);
  const ppiRef = useRef<number | null>(null);
  const windowCornersRef = useRef<Partial<Record<TapCorner, Corner>>>({});
  windowCornersRef.current = windowCorners;
  const tapModeRef = useRef(false);
  tapModeRef.current = tapMode;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).AR) { setArucoLoaded(true); return; }
    try {
      const code = `/*
Copyright (c) 2011 Juan Mellado

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var CV = CV || {};
window.CV = CV;

CV.Image = function(width, height, data){
  this.width = width || 0;
  this.height = height || 0;
  this.data = data || [];
};

CV.grayscale = function(imageSrc, imageDst){
  var src = imageSrc.data, dst = imageDst.data, len = src.length,
      i = 0, j = 0;
  for (; i < len; i += 4){
    dst[j ++] =
      (src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114 + 0.5) & 0xff;
  }
  imageDst.width = imageSrc.width;
  imageDst.height = imageSrc.height;
  return imageDst;
};

CV.threshold = function(imageSrc, imageDst, threshold){
  var src = imageSrc.data, dst = imageDst.data,
      len = src.length, tab = [], i;
  for (i = 0; i < 256; ++ i){
    tab[i] = i <= threshold? 0: 255;
  }
  for (i = 0; i < len; ++ i){
    dst[i] = tab[ src[i] ];
  }
  imageDst.width = imageSrc.width;
  imageDst.height = imageSrc.height;
  return imageDst;
};

CV.adaptiveThreshold = function(imageSrc, imageDst, kernelSize, threshold){
  var src = imageSrc.data, dst = imageDst.data, len = src.length, tab = [], i;
  CV.stackBoxBlur(imageSrc, imageDst, kernelSize);
  for (i = 0; i < 768; ++ i){
    tab[i] = (i - 255 <= -threshold)? 255: 0;
  }
  for (i = 0; i < len; ++ i){
    dst[i] = tab[ src[i] - dst[i] + 255 ];
  }
  imageDst.width = imageSrc.width;
  imageDst.height = imageSrc.height;
  return imageDst;
};

CV.otsu = function(imageSrc){
  var src = imageSrc.data, len = src.length, hist = [],
      threshold = 0, sum = 0, sumB = 0, wB = 0, wF = 0, max = 0,
      mu, between, i;
  for (i = 0; i < 256; ++ i){ hist[i] = 0; }
  for (i = 0; i < len; ++ i){ hist[ src[i] ] ++; }
  for (i = 0; i < 256; ++ i){ sum += hist[i] * i; }
  for (i = 0; i < 256; ++ i){
    wB += hist[i];
    if (0 !== wB){
      wF = len - wB;
      if (0 === wF){ break; }
      sumB += hist[i] * i;
      mu = (sumB / wB) - ( (sum - sumB) / wF );
      between = wB * wF * mu * mu;
      if (between > max){ max = between; threshold = i; }
    }
  }
  return threshold;
};

CV.stackBoxBlurMult =
  [1, 171, 205, 293, 57, 373, 79, 137, 241, 27, 391, 357, 41, 19, 283, 265];
CV.stackBoxBlurShift =
  [0, 9, 10, 11, 9, 12, 10, 11, 12, 9, 13, 13, 10, 9, 13, 13];

CV.BlurStack = function(){ this.color = 0; this.next = null; };

CV.stackBoxBlur = function(imageSrc, imageDst, kernelSize){
  var src = imageSrc.data, dst = imageDst.data,
      height = imageSrc.height, width = imageSrc.width,
      heightMinus1 = height - 1, widthMinus1 = width - 1,
      size = kernelSize + kernelSize + 1, radius = kernelSize + 1,
      mult = CV.stackBoxBlurMult[kernelSize],
      shift = CV.stackBoxBlurShift[kernelSize],
      stack, stackStart, color, sum, pos, start, p, x, y, i;
  stack = stackStart = new CV.BlurStack();
  for (i = 1; i < size; ++ i){ stack = stack.next = new CV.BlurStack(); }
  stack.next = stackStart;
  pos = 0;
  for (y = 0; y < height; ++ y){
    start = pos;
    color = src[pos];
    sum = radius * color;
    stack = stackStart;
    for (i = 0; i < radius; ++ i){ stack.color = color; stack = stack.next; }
    for (i = 1; i < radius; ++ i){ stack.color = src[pos + i]; sum += stack.color; stack = stack.next; }
    stack = stackStart;
    for (x = 0; x < width; ++ x){
      dst[pos ++] = (sum * mult) >>> shift;
      p = x + radius;
      p = start + (p < widthMinus1? p: widthMinus1);
      sum -= stack.color - src[p];
      stack.color = src[p];
      stack = stack.next;
    }
  }
  for (x = 0; x < width; ++ x){
    pos = x;
    start = pos + width;
    color = dst[pos];
    sum = radius * color;
    stack = stackStart;
    for (i = 0; i < radius; ++ i){ stack.color = color; stack = stack.next; }
    for (i = 1; i < radius; ++ i){
      stack.color = dst[start]; sum += stack.color; stack = stack.next; start += width;
    }
    stack = stackStart;
    for (y = 0; y < height; ++ y){
      dst[pos] = (sum * mult) >>> shift;
      p = y + radius;
      p = x + ( (p < heightMinus1? p: heightMinus1) * width );
      sum -= stack.color - dst[p];
      stack.color = dst[p];
      stack = stack.next;
      pos += width;
    }
  }
  return imageDst;
};

CV.gaussianBlur = function(imageSrc, imageDst, imageMean, kernelSize){
  var kernel = CV.gaussianKernel(kernelSize);
  imageDst.width = imageSrc.width; imageDst.height = imageSrc.height;
  imageMean.width = imageSrc.width; imageMean.height = imageSrc.height;
  CV.gaussianBlurFilter(imageSrc, imageMean, kernel, true);
  CV.gaussianBlurFilter(imageMean, imageDst, kernel, false);
  return imageDst;
};

CV.gaussianBlurFilter = function(imageSrc, imageDst, kernel, horizontal){
  var src = imageSrc.data, dst = imageDst.data,
      height = imageSrc.height, width = imageSrc.width,
      pos = 0, limit = kernel.length >> 1, cur, value, i, j, k;
  for (i = 0; i < height; ++ i){
    for (j = 0; j < width; ++ j){
      value = 0.0;
      for (k = -limit; k <= limit; ++ k){
        if (horizontal){
          cur = pos + k;
          if (j + k < 0){ cur = pos; } else if (j + k >= width){ cur = pos; }
        } else {
          cur = pos + (k * width);
          if (i + k < 0){ cur = pos; } else if (i + k >= height){ cur = pos; }
        }
        value += kernel[limit + k] * src[cur];
      }
      dst[pos ++] = horizontal? value: (value + 0.5) & 0xff;
    }
  }
  return imageDst;
};

CV.gaussianKernel = function(kernelSize){
  var tab = [ [1],[0.25,0.5,0.25],[0.0625,0.25,0.375,0.25,0.0625],[0.03125,0.109375,0.21875,0.28125,0.21875,0.109375,0.03125] ],
      kernel = [], center, sigma, scale2X, sum, x, i;
  if ( (kernelSize <= 7) && (kernelSize % 2 === 1) ){ kernel = tab[kernelSize >> 1]; }
  else {
    center = (kernelSize - 1.0) * 0.5; sigma = 0.8 + (0.3 * (center - 1.0));
    scale2X = -0.5 / (sigma * sigma); sum = 0.0;
    for (i = 0; i < kernelSize; ++ i){ x = i - center; sum += kernel[i] = Math.exp(scale2X * x * x); }
    sum = 1 / sum;
    for (i = 0; i < kernelSize; ++ i){ kernel[i] *= sum; }
  }
  return kernel;
};

CV.findContours = function(imageSrc, binary){
  var width = imageSrc.width, height = imageSrc.height, contours = [],
      src, deltas, pos, pix, nbd, outer, hole, i, j;
  src = CV.binaryBorder(imageSrc, binary);
  deltas = CV.neighborhoodDeltas(width + 2);
  pos = width + 3; nbd = 1;
  for (i = 0; i < height; ++ i, pos += 2){
    for (j = 0; j < width; ++ j, ++ pos){
      pix = src[pos];
      if (0 !== pix){
        outer = hole = false;
        if (1 === pix && 0 === src[pos - 1]){ outer = true; }
        else if (pix >= 1 && 0 === src[pos + 1]){ hole = true; }
        if (outer || hole){ ++ nbd; contours.push( CV.borderFollowing(src, pos, nbd, {x: j, y: i}, hole, deltas) ); }
      }
    }
  }
  return contours;
};

CV.borderFollowing = function(src, pos, nbd, point, hole, deltas){
  var contour = [], pos1, pos3, pos4, s, s_end, s_prev;
  contour.hole = hole;
  s = s_end = hole? 0: 4;
  do{ s = (s - 1) & 7; pos1 = pos + deltas[s]; if (src[pos1] !== 0){ break; } }while(s !== s_end);
  if (s === s_end){ src[pos] = -nbd; contour.push( {x: point.x, y: point.y} ); }
  else {
    pos3 = pos; s_prev = s ^ 4;
    while(true){
      s_end = s;
      do{ pos4 = pos3 + deltas[++ s]; }while(src[pos4] === 0);
      s &= 7;
      if ( ( (s - 1) >>> 0) < (s_end >>> 0) ){ src[pos3] = -nbd; }
      else if (src[pos3] === 1){ src[pos3] = nbd; }
      contour.push( {x: point.x, y: point.y} );
      s_prev = s;
      point.x += CV.neighborhood[s][0]; point.y += CV.neighborhood[s][1];
      if ( (pos4 === pos) && (pos3 === pos1) ){ break; }
      pos3 = pos4; s = (s + 4) & 7;
    }
  }
  return contour;
};

CV.neighborhood = [ [1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[-1,1],[0,1],[1,1] ];

CV.neighborhoodDeltas = function(width){
  var deltas = [], len = CV.neighborhood.length, i = 0;
  for (; i < len; ++ i){ deltas[i] = CV.neighborhood[i][0] + (CV.neighborhood[i][1] * width); }
  return deltas.concat(deltas);
};

CV.approxPolyDP = function(contour, epsilon){
  var slice = {start_index:0,end_index:0}, right_slice = {start_index:0,end_index:0},
      poly = [], stack = [], len = contour.length,
      pt, start_pt, end_pt, dist, max_dist, le_eps, dx, dy, i, j, k;
  epsilon *= epsilon; k = 0;
  for (i = 0; i < 3; ++ i){
    max_dist = 0; k = (k + right_slice.start_index) % len; start_pt = contour[k];
    if (++ k === len) {k = 0;}
    for (j = 1; j < len; ++ j){
      pt = contour[k]; if (++ k === len) {k = 0;}
      dx = pt.x - start_pt.x; dy = pt.y - start_pt.y; dist = dx*dx + dy*dy;
      if (dist > max_dist){ max_dist = dist; right_slice.start_index = j; }
    }
  }
  if (max_dist <= epsilon){ poly.push( {x:start_pt.x,y:start_pt.y} ); }
  else {
    slice.start_index = k; slice.end_index = (right_slice.start_index += slice.start_index);
    right_slice.start_index -= right_slice.start_index >= len? len: 0;
    right_slice.end_index = slice.start_index;
    if (right_slice.end_index < right_slice.start_index){ right_slice.end_index += len; }
    stack.push( {start_index:right_slice.start_index,end_index:right_slice.end_index} );
    stack.push( {start_index:slice.start_index,end_index:slice.end_index} );
  }
  while(stack.length !== 0){
    slice = stack.pop();
    end_pt = contour[slice.end_index % len]; start_pt = contour[k = slice.start_index % len];
    if (++ k === len) {k = 0;}
    if (slice.end_index <= slice.start_index + 1){ le_eps = true; }
    else {
      max_dist = 0; dx = end_pt.x - start_pt.x; dy = end_pt.y - start_pt.y;
      for (i = slice.start_index + 1; i < slice.end_index; ++ i){
        pt = contour[k]; if (++ k === len) {k = 0;}
        dist = Math.abs( (pt.y - start_pt.y) * dx - (pt.x - start_pt.x) * dy);
        if (dist > max_dist){ max_dist = dist; right_slice.start_index = i; }
      }
      le_eps = max_dist * max_dist <= epsilon * (dx*dx + dy*dy);
    }
    if (le_eps){ poly.push( {x:start_pt.x,y:start_pt.y} ); }
    else {
      right_slice.end_index = slice.end_index; slice.end_index = right_slice.start_index;
      stack.push( {start_index:right_slice.start_index,end_index:right_slice.end_index} );
      stack.push( {start_index:slice.start_index,end_index:slice.end_index} );
    }
  }
  return poly;
};

CV.warp = function(imageSrc, imageDst, contour, warpSize){
  var src = imageSrc.data, dst = imageDst.data,
      width = imageSrc.width, height = imageSrc.height, pos = 0,
      sx1, sx2, dx1, dx2, sy1, sy2, dy1, dy2, p1, p2, p3, p4,
      m, r, s, t, u, v, w, x, y, i, j;
  m = CV.getPerspectiveTransform(contour, warpSize - 1);
  r = m[8]; s = m[2]; t = m[5];
  for (i = 0; i < warpSize; ++ i){
    r += m[7]; s += m[1]; t += m[4]; u = r; v = s; w = t;
    for (j = 0; j < warpSize; ++ j){
      u += m[6]; v += m[0]; w += m[3];
      x = v / u; y = w / u;
      sx1 = x >>> 0; sx2 = (sx1 === width-1)? sx1: sx1+1;
      dx1 = x - sx1; dx2 = 1.0 - dx1;
      sy1 = y >>> 0; sy2 = (sy1 === height-1)? sy1: sy1+1;
      dy1 = y - sy1; dy2 = 1.0 - dy1;
      p1 = p2 = sy1*width; p3 = p4 = sy2*width;
      dst[pos ++] = (dy2*(dx2*src[p1+sx1]+dx1*src[p2+sx2])+dy1*(dx2*src[p3+sx1]+dx1*src[p4+sx2])) & 0xff;
    }
  }
  imageDst.width = warpSize; imageDst.height = warpSize;
  return imageDst;
};

CV.getPerspectiveTransform = function(src, size){
  var rq = CV.square2quad(src);
  rq[0]/=size; rq[1]/=size; rq[3]/=size; rq[4]/=size; rq[6]/=size; rq[7]/=size;
  return rq;
};

CV.square2quad = function(src){
  var sq = [], px, py, dx1, dx2, dy1, dy2, den;
  px = src[0].x - src[1].x + src[2].x - src[3].x;
  py = src[0].y - src[1].y + src[2].y - src[3].y;
  if (0===px && 0===py){
    sq[0]=src[1].x-src[0].x; sq[1]=src[2].x-src[1].x; sq[2]=src[0].x;
    sq[3]=src[1].y-src[0].y; sq[4]=src[2].y-src[1].y; sq[5]=src[0].y;
    sq[6]=0; sq[7]=0; sq[8]=1;
  } else {
    dx1=src[1].x-src[2].x; dx2=src[3].x-src[2].x;
    dy1=src[1].y-src[2].y; dy2=src[3].y-src[2].y;
    den=dx1*dy2-dx2*dy1;
    sq[6]=(px*dy2-dx2*py)/den; sq[7]=(dx1*py-px*dy1)/den; sq[8]=1;
    sq[0]=src[1].x-src[0].x+sq[6]*src[1].x; sq[1]=src[3].x-src[0].x+sq[7]*src[3].x; sq[2]=src[0].x;
    sq[3]=src[1].y-src[0].y+sq[6]*src[1].y; sq[4]=src[3].y-src[0].y+sq[7]*src[3].y; sq[5]=src[0].y;
  }
  return sq;
};

CV.isContourConvex = function(contour){
  var orientation=0, convex=true, len=contour.length, i=0, j=0,
      cur_pt, prev_pt, dxdy0, dydx0, dx0, dy0, dx, dy;
  prev_pt=contour[len-1]; cur_pt=contour[0];
  dx0=cur_pt.x-prev_pt.x; dy0=cur_pt.y-prev_pt.y;
  for (; i < len; ++ i){
    if (++ j === len) {j=0;}
    prev_pt=cur_pt; cur_pt=contour[j];
    dx=cur_pt.x-prev_pt.x; dy=cur_pt.y-prev_pt.y;
    dxdy0=dx*dy0; dydx0=dy*dx0;
    orientation |= dydx0>dxdy0? 1: (dydx0<dxdy0? 2: 3);
    if (3===orientation){ convex=false; break; }
    dx0=dx; dy0=dy;
  }
  return convex;
};

CV.perimeter = function(poly){
  var len=poly.length, i=0, j=len-1, p=0.0, dx, dy;
  for (; i < len; j=i++){
    dx=poly[i].x-poly[j].x; dy=poly[i].y-poly[j].y;
    p+=Math.sqrt(dx*dx+dy*dy);
  }
  return p;
};

CV.minEdgeLength = function(poly){
  var len=poly.length, i=0, j=len-1, min=Infinity, d, dx, dy;
  for (; i < len; j=i++){
    dx=poly[i].x-poly[j].x; dy=poly[i].y-poly[j].y; d=dx*dx+dy*dy;
    if (d < min){ min=d; }
  }
  return Math.sqrt(min);
};

CV.countNonZero = function(imageSrc, square){
  var src=imageSrc.data, height=square.height, width=square.width,
      pos=square.x+(square.y*imageSrc.width), span=imageSrc.width-width, nz=0, i, j;
  for (i=0; i<height; ++i){ for (j=0; j<width; ++j){ if (0!==src[pos++]){ ++nz; } } pos+=span; }
  return nz;
};

CV.binaryBorder = function(imageSrc, dst){
  var src=imageSrc.data, height=imageSrc.height, width=imageSrc.width, posSrc=0, posDst=0, i, j;
  for (j=-2; j<width; ++j){ dst[posDst++]=0; }
  for (i=0; i<height; ++i){
    dst[posDst++]=0;
    for (j=0; j<width; ++j){ dst[posDst++]=(0===src[posSrc++]? 0: 1); }
    dst[posDst++]=0;
  }
  for (j=-2; j<width; ++j){ dst[posDst++]=0; }
  return dst;
};

var AR = {};
var CV = window.CV;
window.AR = AR;

AR.DICTIONARIES = {
  ARUCO_MIP_36h12: {
    nBits: 36, tau: 12,
    codeList: [0xd2b63a09d,0x6001134e5,0x1206fbe72,0xff8ad6cb4,0x85da9bc49,0xb461afe9c,0x6db51fe13,0x5248c541f,0x8f34503,0x8ea462ece,0xeac2be76d,0x1af615c44,0xb48a49f27,0x2e4e1283b,0x78b1f2fa8,0x27d34f57e,0x89222fff1,0x4c1669406,0xbf49b3511,0xdc191cd5d,0x11d7c3f85,0x16a130e35,0xe29f27eff,0x428d8ae0c,0x90d548477,0x2319cbc93,0xc3b0c3dfc,0x424bccc9,0x2a081d630,0x762743d96,0xd0645bf19,0xf38d7fd60,0xc6cbf9a10,0x3c1be7c65,0x276f75e63,0x4490a3f63]
  }
};

AR.Dictionary = function(dicName){
  this.codes={}; this.codeList=[]; this.tau=0; this._initialize(dicName);
};
AR.Dictionary.prototype._initialize = function(dicName){
  this.codes={}; this.codeList=[]; this.tau=0; this.nBits=0; this.markSize=0; this.dicName=dicName;
  var dictionary=AR.DICTIONARIES[dicName];
  if (!dictionary) throw 'The dictionary "'+dicName+'" is not recognized.';
  this.nBits=dictionary.nBits; this.markSize=Math.sqrt(dictionary.nBits)+2;
  for (var i=0; i<dictionary.codeList.length; i++){
    var code=null;
    if (typeof dictionary.codeList[i]==='number') code=this._hex2bin(dictionary.codeList[i],dictionary.nBits);
    if (typeof dictionary.codeList[i]==='string') code=this._hex2bin(parseInt(dictionary.codeList[i],16),dictionary.nBits);
    if (Array.isArray(dictionary.codeList[i])) code=this._bytes2bin(dictionary.codeList[i],dictionary.nBits);
    if (code===null) throw 'Invalid code '+i;
    this.codeList.push(code);
    this.codes[code]={id:i};
  }
  this.tau=dictionary.tau||this._calculateTau();
};
AR.Dictionary.prototype.find = function(bits){
  var val='', i, j;
  for (i=0; i<bits.length; i++){ var bitRow=bits[i]; for (j=0; j<bitRow.length; j++){ val+=bitRow[j]; } }
  var minFound=this.codes[val];
  if (minFound) return {id:minFound.id,distance:0};
  for (i=0; i<this.codeList.length; i++){
    var code=this.codeList[i]; var distance=this._hammingDistance(val,code);
    if (this._hammingDistance(val,code)<this.tau){ if (!minFound||minFound.distance>distance){ minFound={id:this.codes[code].id,distance:distance}; } }
  }
  return minFound;
};
AR.Dictionary.prototype._hex2bin = function(hex,nBits){ return hex.toString(2).padStart(nBits,'0'); };
AR.Dictionary.prototype._bytes2bin = function(byteList,nBits){
  var bits='', byte;
  for (byte of byteList){ bits+=byte.toString(2).padStart(bits.length+8>nBits?nBits-bits.length:8,'0'); }
  return bits;
};
AR.Dictionary.prototype._hammingDistance = function(str1,str2){
  if (str1.length!=str2.length) throw 'Hamming distance calculation require inputs of the same length';
  var distance=0, i;
  for (i=0; i<str1.length; i++) if (str1[i]!==str2[i]) distance+=1;
  return distance;
};
AR.Dictionary.prototype._calculateTau = function(){
  var tau=Number.MAX_VALUE;
  for(var i=0;i<this.codeList.length;i++) for(var j=i+1;j<this.codeList.length;j++){
    var distance=this._hammingDistance(this.codeList[i],this.codeList[j]);
    tau=distance<tau?distance:tau;
  }
  return tau;
};

AR.Marker = function(id,corners,hammingDistance){ this.id=id; this.corners=corners; this.hammingDistance=hammingDistance; };

AR.Detector = function(config){
  config=config||{};
  this.grey=new CV.Image(); this.thres=new CV.Image(); this.homography=new CV.Image();
  this.binary=[]; this.contours=[]; this.polys=[]; this.candidates=[];
  config.dictionaryName=config.dictionaryName||'ARUCO_MIP_36h12';
  this.dictionary=new AR.Dictionary(config.dictionaryName);
  this.dictionary.tau=config.maxHammingDistance!=null?config.maxHammingDistance:this.dictionary.tau;
};
AR.Detector.prototype.detect = function(image){
  CV.grayscale(image,this.grey); CV.adaptiveThreshold(this.grey,this.thres,2,7);
  this.contours=CV.findContours(this.thres,this.binary);
  this.candidates=this.findCandidates(this.contours,image.width*0.01,0.05,10);
  this.candidates=this.clockwiseCorners(this.candidates);
  this.candidates=this.notTooNear(this.candidates,10);
  return this.findMarkers(this.grey,this.candidates,49);
};
AR.Detector.prototype.findCandidates = function(contours,minSize,epsilon,minLength){
  var candidates=[],len=contours.length,contour,poly,i; this.polys=[];
  for (i=0;i<len;++i){
    contour=contours[i];
    if (contour.length>=minSize){
      poly=CV.approxPolyDP(contour,contour.length*epsilon); this.polys.push(poly);
      if ((4===poly.length)&&(CV.isContourConvex(poly))){ if (CV.minEdgeLength(poly)>=minLength){ candidates.push(poly); } }
    }
  }
  return candidates;
};
AR.Detector.prototype.clockwiseCorners = function(candidates){
  var len=candidates.length,dx1,dx2,dy1,dy2,swap,i;
  for (i=0;i<len;++i){
    dx1=candidates[i][1].x-candidates[i][0].x; dy1=candidates[i][1].y-candidates[i][0].y;
    dx2=candidates[i][2].x-candidates[i][0].x; dy2=candidates[i][2].y-candidates[i][0].y;
    if ((dx1*dy2-dy1*dx2)<0){ swap=candidates[i][1]; candidates[i][1]=candidates[i][3]; candidates[i][3]=swap; }
  }
  return candidates;
};
AR.Detector.prototype.notTooNear = function(candidates,minDist){
  var notTooNear=[],len=candidates.length,dist,dx,dy,i,j,k;
  for (i=0;i<len;++i){
    for (j=i+1;j<len;++j){
      dist=0;
      for (k=0;k<4;++k){ dx=candidates[i][k].x-candidates[j][k].x; dy=candidates[i][k].y-candidates[j][k].y; dist+=dx*dx+dy*dy; }
      if ((dist/4)<(minDist*minDist)){ if (CV.perimeter(candidates[i])<CV.perimeter(candidates[j])){ candidates[i].tooNear=true; } else { candidates[j].tooNear=true; } }
    }
  }
  for (i=0;i<len;++i){ if (!candidates[i].tooNear){ notTooNear.push(candidates[i]); } }
  return notTooNear;
};
AR.Detector.prototype.findMarkers = function(imageSrc,candidates,warpSize){
  var markers=[],len=candidates.length,candidate,marker,i;
  for (i=0;i<len;++i){
    candidate=candidates[i]; CV.warp(imageSrc,this.homography,candidate,warpSize);
    CV.threshold(this.homography,this.homography,CV.otsu(this.homography));
    marker=this.getMarker(this.homography,candidate); if (marker){ markers.push(marker); }
  }
  return markers;
};
AR.Detector.prototype.getMarker = function(imageSrc,candidate){
  var markSize=this.dictionary.markSize;
  var width=(imageSrc.width/markSize)>>>0, minZero=(width*width)>>1, bits=[],rotations=[],square,inc,i,j;
  for (i=0;i<markSize;++i){
    inc=(0===i||(markSize-1)===i)?1:(markSize-1);
    for (j=0;j<markSize;j+=inc){ square={x:j*width,y:i*width,width:width,height:width}; if (CV.countNonZero(imageSrc,square)>minZero){ return null; } }
  }
  for (i=0;i<markSize-2;++i){ bits[i]=[]; for (j=0;j<markSize-2;++j){ square={x:(j+1)*width,y:(i+1)*width,width:width,height:width}; bits[i][j]=CV.countNonZero(imageSrc,square)>minZero?1:0; } }
  rotations[0]=bits; var foundMin=null; var rot=0;
  for (i=0;i<4;i++){
    var found=this.dictionary.find(rotations[i]);
    if (found&&(foundMin===null||found.distance<foundMin.distance)){ foundMin=found; rot=i; if (foundMin.distance===0) break; }
    rotations[i+1]=this.rotate(rotations[i]);
  }
  if (foundMin) return new AR.Marker(foundMin.id,this.rotate2(candidate,4-rot),foundMin.distance);
  return null;
};
AR.Detector.prototype.rotate = function(src){
  var dst=[],len=src.length,i,j;
  for (i=0;i<len;++i){ dst[i]=[]; for (j=0;j<src[i].length;++j){ dst[i][j]=src[src[i].length-j-1][i]; } }
  return dst;
};
AR.Detector.prototype.rotate2 = function(src,rotation){
  var dst=[],len=src.length,i;
  for (i=0;i<len;++i){ dst[i]=src[(rotation+i)%len]; }
  return dst;
};
`;
      const blob = new Blob([code], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);
      const s = document.createElement('script');
      s.src = url;
      s.onload = () => { URL.revokeObjectURL(url); setArucoLoaded(true); };
      s.onerror = () => setCameraError('Failed to load AR library');
      document.head.appendChild(s);
    } catch(e) {
      setCameraError('AR library error');
    }
  }, []);

  useEffect(() => {
    if (dealer) loadRooms();
    return () => stopCamera();
  }, [dealer]);

  const loadRooms = async () => {
    try {
      const data = await roomsService.getRooms(dealer!.id);
      setRooms(data);
    } catch (e) { console.error('Failed to load rooms:', e); }
  };

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const stream = await (navigator as any).mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      setTimeout(() => {
        const video = document.getElementById('wf-video') as HTMLVideoElement;
        if (video) {
          video.srcObject = stream;
          video.play().then(() => {
            setCameraReady(true);
            startLoop();
          }).catch((e: any) => setCameraError(e.message));
        }
      }, 400);
    } catch (e: any) {
      setCameraError('Camera access denied. In Safari: Settings → Privacy → Camera → allow this site.');
    }
  }, []);

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t: any) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
    setMarkerDetected(false);
  };

  const startLoop = () => {
    if (!(window as any).AR && !detectorRef.current) { setTimeout(startLoop, 500); return; }
    if (!detectorRef.current && (window as any).AR) {
      detectorRef.current = new (window as any).AR.Detector();
    }
    const tick = () => {
      const video = document.getElementById('wf-video') as HTMLVideoElement;
      const canvas = document.getElementById('wf-canvas') as HTMLCanvasElement;
      const overlay = document.getElementById('wf-overlay') as HTMLCanvasElement;
      if (!video || !canvas || !overlay || video.readyState < 2 || video.videoWidth === 0) {
        rafRef.current = requestAnimationFrame(tick); return;
      }
      const W = video.videoWidth, H = video.videoHeight;
      canvas.width = W; canvas.height = H; overlay.width = W; overlay.height = H;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0, W, H);
      let markers: any[] = [];
      if (detectorRef.current) { try { markers = detectorRef.current.detect(ctx.getImageData(0, 0, W, H)); } catch (_) {} }
      const oct = overlay.getContext('2d')!;
      oct.clearRect(0, 0, W, H);
      const currentCorners = windowCornersRef.current;
      Object.values(currentCorners).forEach((pt: any) => {
        oct.beginPath(); oct.arc(pt.x, pt.y, 14, 0, Math.PI * 2);
        oct.fillStyle = 'rgba(48,209,88,0.4)'; oct.fill();
        oct.strokeStyle = '#30D158'; oct.lineWidth = 3; oct.stroke();
      });
      const cKeys = Object.keys(currentCorners) as TapCorner[];
      if (cKeys.length === 4) {
        const order: TapCorner[] = ['tl', 'tr', 'br', 'bl'];
        oct.beginPath();
        order.forEach((k, i) => {
          const pt = currentCorners[k]!;
          i === 0 ? oct.moveTo(pt.x, pt.y) : oct.lineTo(pt.x, pt.y);
        });
        oct.closePath();
        oct.strokeStyle = 'rgba(10,132,255,0.8)'; oct.lineWidth = 3; oct.stroke();
        oct.fillStyle = 'rgba(10,132,255,0.1)'; oct.fill();
      }
      if (tapModeRef.current) {
        const cornerOrder: TapCorner[] = ['tl', 'tr', 'bl', 'br'];
        const next = cornerOrder.find(c => !currentCorners[c]);
        const labels: Record<TapCorner, string> = { tl: 'Top Left', tr: 'Top Right', bl: 'Bot Left', br: 'Bot Right' };
        if (next) { oct.font = 'bold 18px sans-serif'; oct.fillStyle = '#FF9F0A'; oct.fillText(`Tap: ${labels[next]}`, 20, 40); }
      }
      const found = markers.find((m: any) => m.id === MARKER_ID);
      if (found) {
        const mc = found.corners;
        const pxW = (dist2d(mc[0], mc[1]) + dist2d(mc[3], mc[2])) / 2;
        const pxH = (dist2d(mc[0], mc[3]) + dist2d(mc[1], mc[2])) / 2;
        const ppi = ((pxW + pxH) / 2) / STICKER_SIZE_IN;
        if (ppi > 5) {
          ppiRef.current = ppi;
          setPixelsPerInch(Math.round(ppi * 10) / 10);
          setMarkerDetected(true); setCalibrationLocked(true);
        }
        oct.beginPath(); oct.moveTo(mc[0].x, mc[0].y);
        mc.forEach((c: any) => oct.lineTo(c.x, c.y));
        oct.closePath(); oct.strokeStyle = '#30D158'; oct.lineWidth = 4; oct.stroke();
        oct.fillStyle = 'rgba(48,209,88,0.12)'; oct.fill();
        oct.fillStyle = '#30D158'; oct.font = 'bold 13px sans-serif';
        oct.fillText(`✓ ${ppi.toFixed(0)} px/in`, mc[0].x, mc[0].y - 8);
      } else { if (!ppiRef.current) { setMarkerDetected(false); } }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const handleCanvasTap = (e: any) => {
    if (!tapModeRef.current || !ppiRef.current) return;
    const overlay = document.getElementById('wf-overlay') as HTMLCanvasElement;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
    const touch = e.touches?.[0] || e.changedTouches?.[0] || e;
    const video2 = document.getElementById('wf-video') as HTMLVideoElement;
    const vW = video2?.videoWidth || overlay.width;
    const vH = video2?.videoHeight || overlay.height;
    const tapX = touch.clientX - rect.left;
    const tapY = touch.clientY - rect.top;
    let x: number, y: number;
    if (vH > vW) {
      const scale = rect.width / vW;
      const displayedH = vH * scale;
      const cropTop = (displayedH - rect.height) / 2;
      x = vW - tapX / scale; y = (tapY + cropTop) / scale;
    } else {
      x = tapX * (vW / rect.width); y = tapY * (vH / rect.height);
    }
    setDebugInfo(`v:${vW}x${vH} tap:(${Math.round(tapX)},${Math.round(tapY)}) mapped:(${Math.round(x)},${Math.round(y)}) ppi:${Math.round(ppiRef.current!)}`);
    const order: TapCorner[] = ['tl', 'tr', 'bl', 'br'];
    const next = order.find(c => !windowCornersRef.current[c]);
    if (!next) return;
    const updated = { ...windowCornersRef.current, [next]: { x, y } };
    setWindowCorners(updated);
    if (Object.keys(updated).length === 4) { computeMeasurement(updated as Record<TapCorner, Corner>); }
  };

  const computeMeasurement = (c: Record<TapCorner, Corner>) => {
    const ppi = ppiRef.current;
    if (!ppi) return;
    const topW = dist2d(c.tl, c.tr), botW = dist2d(c.bl, c.br);
    const leftH = dist2d(c.tl, c.bl), rightH = dist2d(c.tr, c.br);
    const widthIn = Math.round(((topW + botW) / 2 / ppi) * 10) / 10;
    const heightIn = Math.round(((leftH + rightH) / 2 / ppi) * 10) / 10;
    const areaFt = Math.round((widthIn * heightIn / 144) * 100) / 100;
    setMeasurement({ widthIn, heightIn, areaFt });
    setTapMode(false); stopCamera(); setStep('review');
  };

  const dist2d = (a: Corner, b: Corner) => Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);

  const orderWidth = measurement && mountType === 'outside'
    ? Math.round((measurement.widthIn + parseFloat(overlapLeft) + parseFloat(overlapRight)) * 10) / 10
    : measurement?.widthIn ?? null;
  const orderHeight = measurement && mountType === 'outside'
    ? Math.round((measurement.heightIn + parseFloat(overlapTop)) * 10) / 10
    : measurement?.heightIn ?? null;

  const handleSave = async () => {
    if (!dealer || !measurement) return;
    if (!saveForm.roomId && !saveForm.roomName.trim()) {
      Alert.alert('Room required', 'Please select a room or enter a new room name.'); return;
    }
    setSaving(true);
    try {
      let roomId = saveForm.roomId;
      if (saveForm.isNewRoom || !roomId) {
        const r = await roomsService.createRoom({
          dealer_id: dealer.id, customer_id: undefined,
          name: saveForm.roomName.trim(), notes: undefined,
        });
        roomId = r.id;
        await loadRooms();
      }
      await roomsService.saveScanResult({
        dealerId: dealer.id, roomId: roomId!,
        label: saveForm.windowLabel.trim() || 'Window',
        mountType, widthIn: measurement.widthIn, heightIn: measurement.heightIn,
        overlapIn: mountType === 'outside' ? parseFloat(overlapLeft) : 0,
        accuracyIn: 0.25, stickerDetected: markerDetected,
        scanConfidence: markerDetected ? 0.92 : 0.6, photoUrl: undefined,
      });
      setScanCount(c => c + 1);
      await scanService.logScan({
        dealer_id: dealer.id, window_id: undefined, device_model: 'iPhone',
        mount_type: mountType, calibration_method: 'aruco_marker',
        sticker_detected: markerDetected, scan_success: true,
        duration_ms: 5000, confidence: markerDetected ? 0.92 : 0.6,
      });
      Alert.alert(
        '✅ Saved!',
        `Window saved to ${saveForm.isNewRoom ? saveForm.roomName : rooms.find(r => r.id === roomId)?.name ?? 'room'}.`,
        [
          { text: 'Scan Another', onPress: resetFlow },
          { text: 'View Rooms', onPress: () => navigation.navigate('Rooms') },
        ]
      );
    } catch (e: any) {
      Alert.alert('Save failed', e.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const resetFlow = () => {
    stopCamera();
    setStep('sticker'); setMountType('inside'); setMeasurement(null);
    setWindowCorners({}); setMarkerDetected(false); setCalibrationLocked(false);
    setPixelsPerInch(null); setTapMode(false); ppiRef.current = null;
    setSaveForm({ roomId: null, roomName: '', windowLabel: 'Window 1', isNewRoom: false });
  };

  const goToScan = () => { setStep('scan'); setTimeout(startCamera, 100); };
  const cornersDone = Object.keys(windowCorners).length;
  const isCalibrated = calibrationLocked || markerDetected;
  const brandColor = tenantConfig.primary_color;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{tenantConfig.brand_name} Scanner</Text>
        <View style={styles.stepIndicator}>
          {(['sticker', 'mount', 'scan', 'save'] as const).map((s, i) => (
            <View key={s} style={[
              styles.stepDot,
              step === s && { backgroundColor: brandColor, width: 20 },
              step === 'review' && i <= 2 && styles.stepDotDone,
              step === 'save' && styles.stepDotDone,
            ]} />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── PLAN GATE WALL ── */}
        {scanLimitReached ? (
          <View style={styles.gateCard}>
            <Text style={styles.gateEmoji}>🔒</Text>
            <Text style={styles.gateTitle}>Scan Limit Reached</Text>
            <Text style={styles.gateDesc}>
              Your Basic plan includes {limits.maxScansPerMonth} scans per month.
              Upgrade to Pro for unlimited scans, built-in payments, and PDF exports.
            </Text>
            <View style={[styles.gateBadge, { backgroundColor: brandColor + '22', borderColor: brandColor + '55' }]}>
              <Text style={[styles.gateTier, { color: brandColor }]}>
                Current plan: {tier.toUpperCase()}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: brandColor }]}
              onPress={() => navigation.navigate('Settings')}
            >
              <Text style={styles.btnText}>Upgrade to Pro →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSec} onPress={resetFlow}>
              <Text style={styles.btnSecText}>Back</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {step === 'sticker' && (
              <View style={styles.card}>
                <Text style={styles.emoji}>🏷️</Text>
                <Text style={styles.title}>Place Calibration Marker</Text>
                <Text style={styles.desc}>
                  Print the ArUco marker below at exactly 2"×2" and tape it flat inside the window frame.
                  Point your phone at it to calibrate, then step back to frame the whole window.
                </Text>
                <View style={styles.markerWrap}>
                  <View style={styles.markerBox}>
                    {[
                      [1,1,1,1,1,1,1,1],
                      [1,1,1,0,1,0,0,1],
                      [1,1,0,1,0,1,1,1],
                      [1,0,1,1,0,0,0,1],
                      [1,1,1,1,0,1,0,1],
                      [1,0,0,0,0,1,0,1],
                      [1,0,1,1,1,0,1,1],
                      [1,1,1,1,1,1,1,1],
                    ].map((row, ri) => (
                      <View key={ri} style={{ flex: 1, flexDirection: 'row' }}>
                        {row.map((c, ci) => (
                          <View key={ci} style={{ flex: 1, backgroundColor: c ? '#000' : '#fff' }} />
                        ))}
                      </View>
                    ))}
                  </View>
                  <Text style={styles.markerLabel}>Calibration Marker · Print at 2"×2"</Text>
                </View>
                <View style={styles.tip}>
                  <Text style={styles.tipText}>💡 Tape flat on the window sill or inside frame edge. Keep fully visible and unfolded.</Text>
                </View>
                <View style={styles.tip}>
                  <Text style={styles.tipText}>📐 Step close to calibrate (marker fills ~1/4 of screen), then step back to frame the full window.</Text>
                </View>
                <TouchableOpacity style={[styles.btn, { backgroundColor: brandColor }]} onPress={() => setStep('mount')}>
                  <Text style={styles.btnText}>Marker Placed →</Text>
                </TouchableOpacity>
              </View>
            )}

            {step === 'mount' && (
              <View style={styles.card}>
                <Text style={styles.emoji}>🪟</Text>
                <Text style={styles.title}>Select Mount Type</Text>
                <Text style={styles.desc}>Measurements are from the wall edge of the {tenantConfig.product_noun} frame.</Text>
                {(['inside', 'outside'] as MountType[]).map(mt => (
                  <TouchableOpacity
                    key={mt}
                    style={[styles.option, mountType === mt && [styles.optionActive, { borderColor: brandColor }]]}
                    onPress={() => setMountType(mt)}
                  >
                    <View style={styles.optionHeader}>
                      <Text style={styles.optionTitle}>{mt === 'inside' ? 'Inside Mount' : 'Outside Mount'}</Text>
                      {mountType === mt && <Text style={styles.check}>✓</Text>}
                    </View>
                    <Text style={styles.optionDesc}>
                      {mt === 'inside'
                        ? `Covering fits inside the frame. Measures ${tenantConfig.measurement_unit_label} edge-to-edge from wall to wall.`
                        : 'Covering overlaps the frame. Overlap added to all sides.'}
                    </Text>
                    {mt === 'outside' && mountType === 'outside' && (
                      <View style={{ marginTop: 10 }}>
                        <Text style={styles.overlapLabel}>OVERLAP (INCHES)</Text>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          {([['Left', overlapLeft, setOverlapLeft], ['Right', overlapRight, setOverlapRight], ['Top', overlapTop, setOverlapTop]] as any[]).map(([l, v, s]: any) => (
                            <View key={l} style={{ flex: 1, alignItems: 'center' }}>
                              <Text style={styles.overlapSub}>{l}</Text>
                              <TextInput value={v} onChangeText={s} keyboardType="decimal-pad"
                                style={styles.overlapField} selectTextOnFocus />
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
                <View style={styles.row}>
                  <TouchableOpacity style={styles.btnSec} onPress={() => setStep('sticker')}>
                    <Text style={styles.btnSecText}>← Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: brandColor }]} onPress={goToScan}>
                    <Text style={styles.btnText}>Open Camera →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {step === 'scan' && (
              <View style={{ gap: 16 }}>
                <View style={styles.viewport}>
                  {typeof window !== 'undefined' && (
                    <div
                      style={{ position: 'relative', width: '100%', paddingTop: '60%', backgroundColor: '#0D1A2D', overflow: 'hidden', borderRadius: 16 }}
                      onClick={handleCanvasTap}
                    >
                      <video id="wf-video"
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                        autoPlay playsInline muted
                      />
                      <canvas id="wf-canvas" style={{ display: 'none' }} />
                      <canvas id="wf-overlay"
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: tapMode ? 'crosshair' : 'default' }}
                      />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.8))', padding: '20px 14px 12px' }}>
                        {cameraError
                          ? <p style={{ color: '#FF453A', margin: 0, fontSize: 13, fontWeight: 600 }}>⚠️ {cameraError}</p>
                          : !cameraReady
                          ? <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0, fontSize: 13 }}>Starting camera...</p>
                          : isCalibrated
                          ? <p style={{ color: '#30D158', margin: 0, fontSize: 13, fontWeight: 700 }}>
                              ✓ Calibrated · {pixelsPerInch} px/in
                              {tapMode ? ` · Tap corner ${cornersDone + 1}/4` : ` · Step back, then tap Mark ${tenantConfig.product_noun_plural.charAt(0).toUpperCase() + tenantConfig.product_noun_plural.slice(1)} Corners`}
                            </p>
                          : <p style={{ color: '#FF9F0A', margin: 0, fontSize: 13, fontWeight: 600 }}>
                              ⏳ Point at marker to calibrate...
                            </p>
                        }
                        {debugInfo && <p style={{ color: '#FFD60A', margin: '4px 0 0', fontSize: 10, lineHeight: '1.4', wordBreak: 'break-all' }}>{debugInfo}</p>}
                      </div>
                    </div>
                  )}
                </View>
                <View style={{ gap: 12 }}>
                  {cameraError && (
                    <TouchableOpacity style={[styles.btn, { backgroundColor: brandColor }]} onPress={startCamera}>
                      <Text style={styles.btnText}>Retry Camera</Text>
                    </TouchableOpacity>
                  )}
                  {!cameraError && !isCalibrated && cameraReady && (
                    <View style={styles.hints}>
                      <Text style={styles.hintTitle}>Marker not detected yet:</Text>
                      <Text style={styles.hint}>• Move closer — marker should fill ~1/4 of screen</Text>
                      <Text style={styles.hint}>• Ensure good lighting, avoid glare</Text>
                      <Text style={styles.hint}>• Keep marker flat and fully in frame</Text>
                    </View>
                  )}
                  {isCalibrated && !tapMode && (
                    <View style={styles.readyBox}>
                      <View style={styles.ppiBadge}>
                        <Text style={styles.ppiNum}>{pixelsPerInch}</Text>
                        <Text style={styles.ppiLab}>px/in</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.readyTitle}>Calibrated ✓</Text>
                        <Text style={styles.readyDesc}>Step back so the full {tenantConfig.product_noun} is in frame, then tap "Mark Corners" and tap all 4 corners.</Text>
                      </View>
                    </View>
                  )}
                  {tapMode && (
                    <View style={styles.cornerRow}>
                      {(['tl', 'tr', 'bl', 'br'] as TapCorner[]).map((c, i) => (
                        <View key={c} style={[styles.cDot, windowCorners[c] && styles.cDotDone]}>
                          <Text style={styles.cDotTxt}>{i + 1}</Text>
                        </View>
                      ))}
                      <Text style={styles.cornerTxt}>
                        {cornersDone < 4 ? `Tap corner ${cornersDone + 1} of 4 on camera` : 'Computing...'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.row}>
                    <TouchableOpacity style={styles.btnSec} onPress={() => { stopCamera(); setStep('mount'); }}>
                      <Text style={styles.btnSecText}>← Back</Text>
                    </TouchableOpacity>
                    {isCalibrated && !tapMode && (
                      <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: brandColor }]} onPress={() => { setWindowCorners({}); setTapMode(true); }}>
                        <Text style={styles.btnText}>Mark Corners →</Text>
                      </TouchableOpacity>
                    )}
                    {tapMode && (
                      <TouchableOpacity style={[styles.btnSec, { flex: 1 }]} onPress={() => { setWindowCorners({}); setTapMode(false); }}>
                        <Text style={styles.btnSecText}>Reset Corners</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            )}

            {step === 'review' && measurement && (
              <View style={styles.card}>
                <Text style={styles.emoji}>📐</Text>
                <Text style={styles.title}>Measurement Complete</Text>
                <View style={styles.measureRow}>
                  {[
                    [measurement.widthIn + '"', 'Width'],
                    [measurement.heightIn + '"', 'Height'],
                    [measurement.areaFt + ' ft²', 'Area'],
                  ].map(([val, lbl]) => (
                    <View key={lbl} style={[styles.mCell, { borderColor: brandColor + '33', backgroundColor: brandColor + '1A' }]}>
                      <Text style={[styles.mVal, { color: brandColor }]}>{val}</Text>
                      <Text style={styles.mLbl}>{lbl}</Text>
                    </View>
                  ))}
                </View>
                {mountType === 'outside' && (
                  <View style={styles.orderBox}>
                    <Text style={styles.orderTitle}>ORDER SIZE (WITH OVERLAP)</Text>
                    <Text style={styles.orderVal}>{orderWidth}" × {orderHeight}"</Text>
                    <Text style={styles.orderSub}>+{overlapLeft}" left · +{overlapRight}" right · +{overlapTop}" top</Text>
                  </View>
                )}
                <View style={styles.depthBox}>
                  <Text style={styles.depthTitle}>⚠️ Check {tenantConfig.product_noun_plural.charAt(0).toUpperCase() + tenantConfig.product_noun_plural.slice(1)} Depth</Text>
                  <Text style={styles.depthText}>
                    Measure the frame depth (front to back) with a tape measure. Depths under 2.5" may limit product options.
                  </Text>
                </View>
                <View style={[styles.accBadge, !markerDetected && styles.accWarn]}>
                  <Text style={[styles.accText, !markerDetected && { color: '#FF9F0A' }]}>
                    {markerDetected ? '✓ ArUco calibrated · ±0.25" accuracy' : '⚠️ Marker not detected during scan — verify measurements'}
                  </Text>
                </View>
                <View style={styles.row}>
                  <TouchableOpacity style={styles.btnSec} onPress={() => { setMeasurement(null); setWindowCorners({}); setCalibrationLocked(false); ppiRef.current = null; goToScan(); }}>
                    <Text style={styles.btnSecText}>Rescan</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: brandColor }]} onPress={() => setStep('save')}>
                    <Text style={styles.btnText}>Save Measurement →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {step === 'save' && measurement && (
              <View style={styles.card}>
                <Text style={styles.title}>Save to Room</Text>
                <Text style={styles.desc}>
                  {measurement.widthIn}" × {measurement.heightIn}" · {mountType} mount
                  {mountType === 'outside' ? ` · Order: ${orderWidth}" × ${orderHeight}"` : ''}
                </Text>
                <Text style={styles.fieldLbl}>{tenantConfig.product_noun.toUpperCase()} LABEL</Text>
                <TextInput value={saveForm.windowLabel}
                  onChangeText={t => setSaveForm((f: any) => ({ ...f, windowLabel: t }))}
                  style={styles.input} placeholder={`e.g. South ${tenantConfig.product_noun_plural.charAt(0).toUpperCase() + tenantConfig.product_noun_plural.slice(1)}`}
                  placeholderTextColor="rgba(255,255,255,0.25)" />
                <Text style={styles.fieldLbl}>ROOM</Text>
                {rooms.map(r => (
                  <TouchableOpacity key={r.id}
                    style={[styles.roomOpt, saveForm.roomId === r.id && [styles.roomOptActive, { borderColor: brandColor, backgroundColor: brandColor + '1A' }]]}
                    onPress={() => setSaveForm((f: any) => ({ ...f, roomId: r.id, isNewRoom: false, roomName: '' }))}
                  >
                    <Text style={styles.roomOptTxt}>{r.name}</Text>
                    <Text style={styles.roomOptSub}>{r.windows?.length ?? 0} {tenantConfig.product_noun_plural}</Text>
                    {saveForm.roomId === r.id && <Text style={styles.check}>✓</Text>}
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.roomOpt, { borderStyle: 'dashed' }, saveForm.isNewRoom && [styles.roomOptActive, { borderColor: brandColor, backgroundColor: brandColor + '1A' }]]}
                  onPress={() => setSaveForm((f: any) => ({ ...f, isNewRoom: true, roomId: null }))}
                >
                  <Text style={styles.roomOptTxt}>+ New Room</Text>
                </TouchableOpacity>
                {saveForm.isNewRoom && (
                  <TextInput value={saveForm.roomName}
                    onChangeText={t => setSaveForm((f: any) => ({ ...f, roomName: t }))}
                    style={styles.input} placeholder="Room name (e.g. Living Room)"
                    placeholderTextColor="rgba(255,255,255,0.25)" autoFocus />
                )}
                <View style={styles.row}>
                  <TouchableOpacity style={styles.btnSec} onPress={() => setStep('review')}>
                    <Text style={styles.btnSecText}>← Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, { flex: 1, backgroundColor: brandColor }, saving && { opacity: 0.5 }]}
                    onPress={handleSave} disabled={saving}>
                    {saving ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.btnText}>Save ✓</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0F1A' },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  stepIndicator: { flexDirection: 'row', gap: 6 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)' },
  stepDotDone: { backgroundColor: '#30D158' },
  content: { padding: 20, paddingBottom: 60 },
  card: { gap: 14 },
  emoji: { fontSize: 48, textAlign: 'center' },
  title: { color: 'white', fontSize: 20, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  desc: { color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 22, textAlign: 'center' },
  markerWrap: { alignItems: 'center', gap: 10 },
  markerBox: { width: 110, height: 110, backgroundColor: 'white', padding: 8, borderRadius: 8 },
  markerLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  tip: { backgroundColor: 'rgba(255,214,10,0.08)', borderWidth: 1, borderColor: 'rgba(255,214,10,0.2)', borderRadius: 10, padding: 12 },
  tipText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 20 },
  option: { backgroundColor: '#111827', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, gap: 8 },
  optionActive: { backgroundColor: 'rgba(10,132,255,0.08)' },
  optionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  optionTitle: { color: 'white', fontWeight: '700', fontSize: 16 },
  optionDesc: { color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 20 },
  check: { color: '#30D158', fontSize: 18, fontWeight: '700' },
  overlapLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  overlapSub: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 4 },
  overlapField: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 8, color: 'white', fontSize: 16, fontWeight: '700', textAlign: 'center', padding: 8, width: '100%' },
  viewport: { borderRadius: 16, overflow: 'hidden' },
  hints: { backgroundColor: '#111827', borderRadius: 12, padding: 14, gap: 6 },
  hintTitle: { color: 'white', fontWeight: '700', fontSize: 13, marginBottom: 4 },
  hint: { color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 20 },
  readyBox: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(48,209,88,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(48,209,88,0.2)' },
  ppiBadge: { alignItems: 'center', minWidth: 50 },
  ppiNum: { color: '#30D158', fontSize: 22, fontWeight: '800' },
  ppiLab: { color: 'rgba(255,255,255,0.4)', fontSize: 10 },
  readyTitle: { color: '#30D158', fontWeight: '700', fontSize: 14 },
  readyDesc: { color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 18 },
  cornerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#111827', borderRadius: 12, padding: 12 },
  cDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  cDotDone: { backgroundColor: '#30D158', borderColor: '#30D158' },
  cDotTxt: { color: 'white', fontWeight: '700', fontSize: 12 },
  cornerTxt: { color: 'rgba(255,255,255,0.5)', fontSize: 12, flex: 1 },
  measureRow: { flexDirection: 'row', gap: 10 },
  mCell: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  mVal: { fontSize: 22, fontWeight: '800' },
  mLbl: { color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 2 },
  orderBox: { backgroundColor: 'rgba(48,209,88,0.08)', borderWidth: 1, borderColor: 'rgba(48,209,88,0.2)', borderRadius: 12, padding: 14 },
  orderTitle: { color: '#30D158', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  orderVal: { color: 'white', fontSize: 22, fontWeight: '800', marginTop: 4 },
  orderSub: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
  depthBox: { backgroundColor: 'rgba(255,159,10,0.08)', borderWidth: 1, borderColor: 'rgba(255,159,10,0.3)', borderRadius: 12, padding: 14, gap: 6 },
  depthTitle: { color: '#FF9F0A', fontWeight: '700', fontSize: 14 },
  depthText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 20 },
  accBadge: { backgroundColor: 'rgba(48,209,88,0.08)', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(48,209,88,0.2)' },
  accWarn: { backgroundColor: 'rgba(255,159,10,0.08)', borderColor: 'rgba(255,159,10,0.2)' },
  accText: { color: '#30D158', fontSize: 12, fontWeight: '600' },
  fieldLbl: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 10, color: 'white', fontSize: 15, padding: 12 },
  roomOpt: { backgroundColor: '#111827', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roomOptActive: { },
  roomOptTxt: { color: 'white', fontWeight: '600', fontSize: 14, flex: 1 },
  roomOptSub: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginRight: 8 },
  row: { flexDirection: 'row', gap: 10 },
  btn: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  btnSec: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingVertical: 15, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  btnSecText: { color: 'rgba(255,255,255,0.7)', fontWeight: '600', fontSize: 14 },
  // Plan gating styles
  gateCard: { gap: 16, alignItems: 'center', paddingVertical: 32 },
  gateEmoji: { fontSize: 56, textAlign: 'center' },
  gateTitle: { color: 'white', fontSize: 22, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  gateDesc: { color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 22, textAlign: 'center', maxWidth: 300 },
  gateBadge: { borderWidth: 1, borderRadius: 100, paddingVertical: 6, paddingHorizontal: 16 },
  gateTier: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
});