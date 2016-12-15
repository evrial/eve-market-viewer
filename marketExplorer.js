/*!
 * Sections of code from https://github.com/jimpurbrick/crestexplorerjs
 *  Copyright 2012, CCP (http://www.ccpgames.com)
 *  Dual licensed under the MIT or GPL Version 2 licenses.
 *  http://www.opensource.org/licenses/mit-license.php
 *  http://www.opensource.org/licenses/GPL-2.0
 *
 *  All other code is under the MIT license.
 *
*/
"use strict";
// Configuration parameters
var baseURL = "https://crest-tq.eveonline.com";
var endpoints;
var regions = {};  // {int:id: obj:region}
var marketGroups;
var currentRegion = {id: 10000002};
var searchObj = [];
var presetRegion = 'The Forge';
var presetTypeid = 29668;

// http://stackoverflow.com/a/14994860/1363211
function nFormatter(num) {
     if (num >= 1e12) {
        return (num / 1e12).toFixed(2).replace(/\.0*$/, '') + 'T';
     }
     if (num >= 1e9) {
        return (num / 1e9).toFixed(1).replace(/\.0*$/, '') + 'B';
     }
     if (num >= 1e6) {
        return (num / 1e6).toFixed().replace(/\.0*$/, '') + 'M';
     }
     if (num >= 1e3) {
        return (num / 1e3).toFixed().replace(/\.0*$/, '') + 'K';
     }
     return num;
}

function to_USD(isk) {
    // convert an in-game ISK to USD equvalent using PLEX price
    // do not take it seriously
    return (isk / 1e9 * 17.5).toFixed();
}

function sortByKey(array, key) {
    return array.sort(function(a, b) {
        var x = a[key]; var y = b[key];
        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    });
}

(function ($, window, document) {

    var headers = {
        "Accept": "application/json, charset=utf-8",
        // "Accept-Language": "en"
    };
    if ($.cookie('language')) {
        headers['Accept-Language'] = $.cookie('language');
    }

    $.ajaxSetup({
        accepts: "application/json, charset=utf-8",
        crossDomain: true,
        type: "GET",
        dataType: "json",
        headers: headers,
        error: function (xhr, status, error) {
            displayError(error);
        }
    });

    $(document).ajaxStart(function() {
        $(document.body).css({'cursor' : 'wait'});
    }).ajaxStop(function() {
        $(document.body).css({'cursor' : 'auto'});
    });

    // initialize swagger client, point to a resource listing
    window.client = new SwaggerClient({
        url: "https://esi.tech.ccp.is/latest/swagger.json?datasource=tranquility",
        success: function() {}
    });

// type in browser console:
// client.Market.get_markets_region_id_orders({region_id: 10000002, type_id: 42231, order_type: 'all'})
    function drawChart() {
        client.Market.get_markets_region_id_history(
            {region_id: currentRegion.id, type_id: presetTypeid},
            {responseContentType: 'application/json'},
            function(data) {
                var average = [],
                    highest = [],
                    lowest = [],
                    volume = [],
                    revenue = [];
                for (var i=0, len=data.obj.length; i < len; i++) {
                    average.push([Date.parse(data.obj[i].date), data.obj[i].average]);
                    highest.push([Date.parse(data.obj[i].date), data.obj[i].highest]);
                    lowest.push([Date.parse(data.obj[i].date), data.obj[i].lowest]);
                    volume.push([Date.parse(data.obj[i].date), data.obj[i].volume]);
                    revenue.push([Date.parse(data.obj[i].date), data.obj[i].volume * data.obj[i].average]);
                }

                Highcharts.stockChart('chart', {
                    rangeSelector: {
                        selected: 1
                    },
                    legend: {
                        enabled: true
                    },
                    credits: {
                        enabled: false
                    },
                    xAxis: {
                        type: 'datetime',
                        ordinal: false,
                    },
                    yAxis: [{ // Primary yAxis
                        title: {
                            text: 'Price'
                        },
                        height: '60%',
                        opposite: true
                    }, { // Secondary yAxis
                        title: {
                            text: 'Revenue'
                        },
                        top: '65%',
                        height: '35%',
                        offset: 0,
                        opposite: true
                    }, { // Tertiary yAxis
                        labels: {
                            align: 'left',
                            x: 0
                        },
                        title: {
                            text: 'Volume'
                        },
                        top: '65%',
                        height: '35%',
                        opposite: false
                    }],
                    series: [{
                        name: 'Average',
                        data: average,
                        tooltip: {
                            valueDecimals: 2,
                            valueSuffix: ' ISK'
                        },
                    }, {
                        name: 'High',
                        data: highest,
                        tooltip: {
                            valueDecimals: 2,
                            valueSuffix: ' ISK'
                        }
                    }, {
                        name: 'Low',
                        data: lowest,
                        tooltip: {
                            valueDecimals: 2,
                            valueSuffix: ' ISK'
                        }
                    }, {
                        name: 'Volume',
                        type: 'column',
                        data: volume,
                        yAxis: 2
                    }, {
                        name: 'Revenue',
                        type: 'areaspline',
                        data: revenue,
                        yAxis: 1,
                        tooltip: {
                            valueDecimals: 2,
                            valueSuffix: ' ISK'
                        },
                        fillOpacity: 0.3,
                        zIndex: 0
                    }]
                });
            }
        );
    }

    $.urlParam = function(name){
        var results = new RegExp('[\\?&]' + name + '=([^&#]*)').exec(window.location.href);
        if (results===null) {
            return null;
        }
        else {
            return results[1] || 0;
        }
    };

    // Show error message in main data pane.
    function displayError(error) {
        $("#data").children().replaceWith("<span>" + error + "</span>");
    }

    function loadEndpoints() {
        $.getJSON(baseURL,function(data,status,xhr) {
            endpoints = data;
            loadRegions();
            loadMarketGroups();
        });
    }

    function loadRegions() {
        $.getJSON(endpoints.regions.href,function(data,status,xhr) {
            $.map(data.items,function(value){
                if ((!value.name.match('.-R00')) || (value.name==='G-R00031')) {
                   $("#regionSelector").append("<option value='"+value.href+"'>"+value.name+"</option>");
                   regions[value.id] = value;
                }
            });
            $(' #regionSelector option:contains("' + presetRegion + '")').prop('selected', true);
            $( "#regionSelector" ).selectmenu( "refresh" );
            loadRegionData();
        });
    }

    function loadMarketGroups() {
        $.getJSON(endpoints.marketGroups.href,function(data,status,xhr) {
            marketGroups=data.items;
            $.map(marketGroups,function(group){
                if (typeof group.parentGroup === 'undefined') {
                    $("#marketGroups").append("<li data-cresthref='"+group.href+"' class='groupLink' title='"+group.description+"' >"+group.name+"</li>");
                }
            });
            $('.groupLink').click(function(event){event.stopPropagation();openSubGroup(event.target);});
            $("#marketgroupmain").show();
        });
    }

    function openSubGroup(group) {
        var node;
        var itemcount=0;
        if ($(group).children('ul').length>0) {
            $(group).children('ul').toggle();
        } else {
            $(group).append('<ul class="subdisplay"></ul>');
            node=$(group).children('ul');
            $.map(marketGroups,function(subgroup){
            if (typeof subgroup.parentGroup != 'undefined' && subgroup.parentGroup.href === group.dataset.cresthref) {
                node.append("<li data-cresthref='"+subgroup.href+"' class='groupLink' title='"+subgroup.description+"' >"+subgroup.name+"</li>");
            }
            if (subgroup.href === group.dataset.cresthref) {
                $.getJSON(subgroup.types.href,function(data,status,xhr) {
                    $.map(data.items,function(item){
                        if (item.marketGroup.href== group.dataset.cresthref) {
                            node.append("<li data-cresthref='"+item.type.href+"' class='itemLink'><img width=16 hieght=16 src='"+item.type.icon.href+"'  data-cresthref='"+item.type.href+"'>"+item.type.name+"</li>");
                            itemcount++;
                        }
                    });

                    if (itemcount>0) {
                     $('.itemLink').click(function(event){
                        event.stopPropagation();
                        openItem(event.target.dataset.cresthref);
                        });
                    }
                });
            }
            });
        }
    }

    function loadRegionData() {
        if ($("#regionSelector").val() === 'Universe') {
            loadUniverseMarket();
            return;
        }
        $.getJSON($("#regionSelector").val(),function(data,status,xhr) {
            currentRegion=data;
            openItem(baseURL+"/inventory/types/"+presetTypeid+"/");
            // openItem(type_id, region_id);
        });
    }

    function loadUniverseMarket() {
        function getData(url) {
            return $.getJSON(url);  // this returns a "promise"
        }

        var promises = [],
            results = [];

        $.each(regions, function(key,val){
            promises.push(getData(baseURL+"/market/"+val.id+"/orders/sell/?type="+baseURL+"/inventory/types/"+presetTypeid+"/"));
            promises.push(getData(baseURL+"/market/"+val.id+"/orders/buy/?type="+baseURL+"/inventory/types/"+presetTypeid+"/"));
        });

        $.when.apply($, promises).done(function(){
            for (var i = 0; i < arguments.length; i++) {
                var orders = arguments[i][0].items
                if (orders.length > 0){
                    results.push(orders);
                }
            }

        var buytable;
        var selltable;
        // $('#MarketDisplay').show();
        buytable=$('#buy').DataTable();
        buytable.rows().remove();
        selltable=$('#sell').DataTable();
        selltable.rows().remove();
        buytable.draw();
        selltable.draw();

        $.getJSON(baseURL+"/inventory/types/"+presetTypeid+"/",function(data,status,xhr) {
            presetTypeid = data.id;
            $('#itemDescription').html("<h2><img src='https://imageserver.eveonline.com/Type/"+data.id+"_64.png'>"+data.name+"</h2><p>"+data.description.replace(/[\r\n]+/g, '<br>')+"</p>");

            drawChart();
        });


        $.map(results,function(orderlist){
            $.map(orderlist, function(item) {
            if (item.buy === true) {
                buytable.row.add([
                    $("#regionSelector option:selected").text(),
                    $.number(item.volume),
                    $.number(item.price,2),
                    item.location.name,
                    item.range,
                    $.number(item.minVolume),
                    moment(item.issued).add(item.duration,'days').fromNow(),
                    moment(item.issued).format("YYYY-MM-DD HH:mm:ss")
                ]);
            } else {
                selltable.row.add([
                    $("#regionSelector option:selected").text(),
                    $.number(item.volume),
                    $.number(item.price,2),
                    item.location.name,
                    moment(item.issued).add(item.duration,'days').fromNow(),
                    moment(item.issued).format("YYYY-MM-DD HH:mm:ss")
                ]);
            }
            });
        });
        selltable.draw();
        buytable.draw();


        try {
             var stateObj = {};
             history.pushState(stateObj, presetTypeid, "?typeid="+presetTypeid+"&region="+regionname);
        }
        catch(err) {
            console.log("No pushstate");
        }

        });
    }

// https://datatables.net/examples/ajax/custom_data_property.html
// https://datatables.net/reference/api/ajax.reload()
    function openItem(typehref) {
        var buytable = $('#buy').DataTable(),
            selltable = $ ('#sell').DataTable(),
            regionname = $("#regionSelector option:selected").text();

        buytable.rows().remove();
        selltable.rows().remove();
        buytable.draw();
        selltable.draw();
        // $('#MarketDisplay').show();

        $.getJSON(typehref,function(data,status,xhr) {
            $('#itemDescription').html(
                "<h2><img src='https://imageserver.eveonline.com/Type/"+data.id+"_64.png'>"+data.name+"</h2><p>"
                + data.description.replace(/[\r\n]+/g, '<br>') + "</p>");

            try {
                 history.pushState(null, null, "?typeid="+data.id+"&region="+regionname);
                 presetTypeid = data.id;
                 drawChart();
            }
            catch(err) {
                console.log("No pushstate");
            }
        });

        var sellCap = 0, buyCap = 0;

        if (typeof currentRegion != 'undefined') {
            $.getJSON(currentRegion.marketSellOrders.href+'?type='+typehref,function(data,status,xhr) {
                $.map(data.items,function(item){
                    sellCap += item.volume * item.price;
                    selltable.row.add([
                        currentRegion.name,
                        $.number(item.volume),
                        $.number(item.price,2),
                        item.location.name,
                        moment(item.issued).add(item.duration,'days').fromNow(),
                        moment(item.issued).format("YYYY-MM-DD HH:mm:ss")
                    ]);
                });
                selltable.draw();
                $("#sellCap").text('Sell '+nFormatter(sellCap)).attr('title', '$'+to_USD(sellCap));
            });

            $.getJSON(currentRegion.marketBuyOrders.href+'?type='+typehref,function(data,status,xhr) {
                $.map(data.items,function(item){
                    buyCap += item.volume * item.price;
                    buytable.row.add([
                        currentRegion.name,
                        $.number(item.volume),
                        $.number(item.price,2),
                        item.location.name,
                        item.range,
                        $.number(item.minVolume),
                        moment(item.issued).add(item.duration,'days').fromNow(),
                        moment(item.issued).format("YYYY-MM-DD HH:mm:ss")
                    ]);
                });
                buytable.draw();
                $("#buyCap").text('Buy '+nFormatter(buyCap)).attr('title', '$'+to_USD(buyCap));
            })
        } else {
            alert('Set a region to get data');
        }
    }

    function setLanguage() {
        if ($("#language").val() === "Default") {
            $.removeCookie('language');
        } else {
            $.cookie('language', $("#language").val());
        }
        location.reload();
    }

    function emptyCache() {
        searchObj=[];
        localStorage.removeItem('searchCache');
        console.log('localStorage empty');
        $('#search').hide();
        $('#emptycache').hide();
        $('#loadcache').show();
    }

    function loadSearchCache(page=baseURL+'/market/types/') {
        var cachedata = localStorage.getItem('searchCache');
        if (cachedata) {
            try {
                searchObj = JSON.parse(cachedata);
                console.log("Loading from localStorage: "+searchObj.length+' items, '+cachedata.length+' bytes total. ');
            } catch(e) {
                console.log(e);
            }
        } else {
            $.getJSON(page,function(data,status,xhr) {
               // console.log(page);
               // console.log(data.items);
               $.map(data.items,function(item){
                   searchObj.push({
                       id: item.type.id,
                       href: item.type.href,
                       label: item.type.name,
                       icon: item.type.icon.href,
                       marketid: item.marketGroup.id,
                       markethref: item.marketGroup.href
                   });
               });
               if (typeof data.next != 'undefined') {
                   loadSearchCache(data.next.href);
               } else {
                   var cachedata = JSON.stringify(searchObj);
                   console.log("saving to localStorage: "+searchObj.length+" items, " + cachedata.length + ' bytes total.');
                   localStorage.setItem("searchCache", cachedata);
               }
            });
        }

        $('#loadcache').hide();
        $('#emptycache').show();
        $('#search').show().focus();
        $('#search').autocomplete({
          autoFocus: true,
          minLength: 3,
          delay: 0,
          source: searchObj,
          select: function(event, ui) {
            $("#search").val(ui.item.value);
            openItem(ui.item.href);
          }
        });
    }

    function doSearch() {
        var searchString = $('#search').val().trim().replace('/','').toLowerCase();
        $('#marketGroups').hide();
        $('#searchList').empty();
        $('#searchList').show();
        $.map(searchObj,function(item){
            if (item.label.toLowerCase().match(searchString)) {
                $('#searchList').append("<li data-cresthref='"+item.href+"' class='itemLink'><img width=16 height=16 src='"+item.icon+"' data-cresthref='"+item.href+"'>"+item.label+"</li>");
            }
        });
        $('.itemLink').click(function(event){
            event.stopPropagation();
            openItem(event.target.dataset.cresthref);
        });
    }

    $(document).ready(function() {
        loadEndpoints();

        // https://jsfiddle.net/adamboduch/EwwEC/
        $.widget( "app.autocomplete", $.ui.autocomplete, {
            _renderItem: function( ul, item ) {
                var result = this._super( ul, item );
                result.addClass( "ui-menu-item-icon" )
                    .css( "background-image", "url('https://imageserver.eveonline.com/Type/"+item.id+"_32.png')" );

                return result;
            }
        });

        $('#buy').DataTable({
            "paging": false,
            "scrollY": "40%",
            "bFilter": false,
            "bInfo": false,
            "bAutoWidth": false,
            "bSortClasses": false,
            "bDeferRender": false,
            "sDom": 'C<"clear">lfrtip',
            "order":[[2,"desc"]],
            "columnDefs": [
                { className: "dt-left"},
                { className: "dt-right"},
                { className: "dt-right"},
                { className: "dt-right"},
                { className: "dt-right"},
                { className: "dt-right"},
                { className: "dt-right"}
            ]
        });
        $('#sell').DataTable({
            "paging": false,
            "scrollY": "40%",
            "bFilter": false,
            "bInfo": false,
            "bAutoWidth": false,
            "bSortClasses": false,
            "bDeferRender": false,
            "sDom": 'C<"clear">lfrtip',
            "order":[[2,"asc"]],
            "columnDefs": [
                { className: "dt-left"},
                { className: "dt-right"},
                { className: "dt-right"},
                { className: "dt-right"},
                { className: "dt-right"},
                { className: "dt-right"}
            ]
        });

        $( "#searchList" ).hide();
        // $( "#MarketDisplay" ).hide();

        if (isFinite($.urlParam('typeid')) && ($.urlParam('typeid')!=null)) {
            presetTypeid=parseInt($.urlParam('typeid'));
        }

        if ($.urlParam('region')!=null) {
            presetRegion=decodeURIComponent($.urlParam('region'));
        }

        var lang = $.cookie('language') || (navigator.languages
                    ? navigator.languages[0]
                    : (navigator.language || navigator.userLanguage)).split('-')[0];

        $('#language option[value='+lang+']').prop('selected', true);

        $( "#language" ).selectmenu({
          change: function( event, ui ) {
            setLanguage();
          }
        });
        $( "#regionSelector" ).selectmenu({
          change: function( event, ui ) {
            loadRegionData();
          }
        });
        $('#loadcache').click(function() {
            loadSearchCache();
        });
        $('#emptycache').click(function() {
            emptyCache();
        }).hide();
        $('#search').change(function() {
            doSearch();
        }).hide();
        $('#search').click(function () {
           $(this).select();
        });

        $( document ).tooltip();

        $( "#dialog" ).dialog({
            autoOpen: false
        });
        $( "#opener" ).on( "click", function() {
            $( "#dialog" ).dialog( "open" );
        });
        // $('.majorpoints').click(function(){
        //     $(this).find('.hider').toggle();
        // });

    });

}($, window, document));
