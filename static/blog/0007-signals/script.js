"use strict";

function get_period_a(){
    return parseInt(document.getElementById("period_a").value);
}

function get_period_b(){
    return parseInt(document.getElementById("period_b").value);
}

function get_relative_time(){
    return parseInt(document.getElementById("relative_time").innerHTML);
}

function get_steps(){
    return parseInt(document.getElementById("steps").innerHTML);
}

function set_steps(n){
    return document.getElementById("steps").innerHTML = n;
}

function set_relative_time(n){
    document.getElementById("relative_time").innerHTML = n;
}

function wave_step(){
    set_steps(get_steps() + 1);
    wave_render();
}

function wave_reset(){
    set_relative_time(0);
    set_steps(0);
    wave_render();
}

function get_wavedrom(inp){
    var wave = "";
    var data = Array();

    var value, period, color;
    for (let i = 0; i < inp.length; i++){
        [value, period, color] = inp[i];
        
        data.push(value);
        wave += color;
        for (let j = 0; j < period - 1; j++){
            wave += ".";
        }
    }

    return [wave, data];
}

function get_clock(inp){
    var wave = "l";

    for (let i = 0; i < 2*inp[0][1] - 1; i++){
        wave += ".";
    }

    var value, period, color;
    for (let i = 1; i < inp.length; i++){
        [value, period, color] = inp[i];
        
        wave += "h";
        for (let j = 0; j < period - 1; j++){
            wave += ".";
        }

        wave += "l";
        for (let j = 0; j < period - 1; j++){
            wave += ".";
        }
    }

    return wave;
}

function get_node(inp, label){
    var node = Array();

    var value, period, color;
    for (let i = 0; i < inp.length; i++){
        [value, period, color] = inp[i];
        for (let j = 0; j < period; j++){
            node.push(".");
        }
    }

    node[node.length - 1] = label;
    
    return node;
}

function merge_node(a, b){
    var result = ".";
    var length = Math.max(a.length, b.length);

    // normalize array lengths
    for (let i = a.length; i < length; i++){
        a.push(".");
    }

    for (let i = b.length; i < length; i++){
        b.push(".");
    }

    for (let i = 0; i < length; i++){
        if (a[i] == "."){
            result += b[i];
        } else {
            result += a[i];
        }
    }
    console.log(result);
    return result;
}

function wave_render(){
    // Update references to periods (A)
    const period_a = get_period_a();
    const period_as = document.getElementsByClassName("period_a");
    for (let i = 0; i < period_as.length; i++) {
        period_as.item(i).innerHTML = period_a;
    }

    // Update references to periods (B)
    const period_b = get_period_b();
    const period_bs = document.getElementsByClassName("period_b");
    for (let i = 0; i < period_bs.length; i++) {
        period_bs.item(i).innerHTML = period_b;
    }

    var n_steps = get_steps() + 1;

    // Array([value, period, color])
    const a = Array();
    const b = Array();

    var relative_time = 0;
    var last_relative_time = 0;
    var value_a = 0;
    var a_iters = 0;
    var b_iters = 0;
    var last_step = "ab";
    for (let step = 0; step < n_steps; step++){
        last_relative_time = relative_time;

        if (relative_time < 0){
            last_step = "b";
            b.push([value_a, period_b, "2"]);
            b_iters = b_iters + 1;
            relative_time = relative_time + period_b;
        } else if (relative_time == 0) {
            last_step = "ab";
            b_iters = b_iters + 1;
            a_iters = a_iters + 1;
            b.push([value_a, period_b, "2"]);
            a.push([value_a, period_a, "2"]);
            relative_time = relative_time + period_b - period_a;
            value_a = value_a + 1;
        } else {
            last_step = "a";
            a_iters = a_iters + 1;
            a.push([value_a, period_a, "2"]);
            value_a = value_a + 1;
            relative_time = relative_time - period_a;
        }
    }

    // Set period of value before first clock tick to 1
    a[0][1] = 1;
    b[0][1] = 1;

    // Draw "next" step with a different color
    if (last_step == "a"){
        a[a.length - 1][2] = "5";
    } else if (last_step == "b"){
        b[b.length - 1][2] = "5";
    } else if (last_step == "ab"){
        a[a.length - 1][2] = "5";
        b[b.length - 1][2] = "5";
    } else {
        console.log("Error: last_step is invalid: " + last_step);
        return;
    }

    // Draw "current value of a"
    if (last_step == "a"){
        b.push([-1, period_b, "x"]);
    } else if (last_step == "b"){
        a.push([value_a, period_a, "6"]);
    } else if (last_step == "ab"){
    } else {
        console.log("Error: last_step is invalid: " + last_step);
        return;
    }
    
    // Show/hide "next action" elements
    if (last_step == "a"){
        document.getElementById("a-0").style.display = "block";
        document.getElementById("a-1").style.display = "block";
        document.getElementById("ab-0").style.display = "none";
        document.getElementById("ab-1").style.display = "none";
        document.getElementById("b-0").style.display = "none";
        document.getElementById("b-1").style.display = "none";
    } else if (last_step == "ab"){
        document.getElementById("a-0").style.display = "none";
        document.getElementById("a-1").style.display = "none";
        document.getElementById("ab-0").style.display = "block";
        document.getElementById("ab-1").style.display = "block";
        document.getElementById("b-0").style.display = "none";
        document.getElementById("b-1").style.display = "none";
    } else if (last_step == "b"){
        document.getElementById("a-0").style.display = "none";
        document.getElementById("a-1").style.display = "none";
        document.getElementById("ab-0").style.display = "none";
        document.getElementById("ab-1").style.display = "none";
        document.getElementById("b-0").style.display = "block";
        document.getElementById("b-1").style.display = "block";
    } else {
        console.log("Error: last_step is invalid: " + last_step);
        return;
    }

    set_relative_time(last_relative_time);

    var scale = 1;

    var a_wave, a_data;
    [a_wave, a_data] = get_wavedrom(a);

    var b_wave, b_data;
    [b_wave, b_data] = get_wavedrom(b);

    var node = merge_node(get_node(a, "A"), get_node(b, "B"));

    const data = {
        signal: [
            { name: "clock A",  wave: get_clock(a), period: 0.5*scale },
            { name: "clock B",  wave: get_clock(b), period: 0.5*scale },
            { name: "data (A)", wave: a_wave, data: a_data, period: scale },
            { name: "data (B)", wave: b_wave, data: b_data, period: scale },
            { name: "", node : node, period: scale},
        ],
        edge: [
            ((node.indexOf("B") == -1) ? "A+A " : "A+B ") + Math.abs(get_relative_time()),
        ]
    };

    console.log(data);

    WaveDrom.RenderWaveForm(0, data, "interactive_wavedrom_", true);
}

wave_render();