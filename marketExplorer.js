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

// Configuration parameters
var baseURL = "https://crest-tq.eveonline.com";
var endpoints;
var regions={};  // {regionid: regionobj}
var marketGroups;
var currentRegion;
// var currentGroup;
var searchObj=Array();
var presetRegion='The Forge';
var presetTypeid=29668;


(function ($, window, document) {

    $.urlParam = function(name){
        var results = new RegExp('[\\?&]' + name + '=([^&#]*)').exec(window.location.href);
        if (results===null){
           return null;
       }
       else{
           return results[1] || 0;
      }
    };

    // Show error message in main data pane.
    function displayError(error) {
        $("#data").children().replaceWith("<span>" + error + "</span>");
    }

    function loadEndpoints() {
        $.getJSON(baseURL,function(data,status,xhr) {
            window.endpoints=data;
            loadRegions();
            loadMarketGroups();
        }).fail(displayError('CREST offline'));
    }

    function loadRegions() {
        $.getJSON(window.endpoints.regions.href,function(data,status,xhr) {
            $.map(data.items,function(value){
                if ((!value.name.match('.-R00')) || (value.name=='G-R00031')) {
                   $("#regionSelector").append("<option value='"+value.href+"'>"+value.name+"</option>");
                   regions[value.id] = value;
                }
            });
            $(' #regionSelect option:contains("' + presetRegion + '")').prop('selected', true);
            $( "#regionSelector" ).selectmenu( "refresh" );
            $(" #regionSelect ").show();
            loadRegionData();
        });
    }

    function loadMarketGroups() {
        $.getJSON(window.endpoints.marketGroups.href,function(data,status,xhr) {
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

    function loadUniverseMarket() {
        function getData(url) {
            return $.getJSON(url);  // this returns a "promise"
        }
        var promises = [];
        var results = [];
        $.each(regions, function(key,val){
            promises.push(getData(baseURL+"/market/"+val.id+"/orders/sell/?type="+baseURL+"/inventory/types/"+presetTypeid+"/"));
            promises.push(getData(baseURL+"/market/"+val.id+"/orders/buy/?type="+baseURL+"/inventory/types/"+presetTypeid+"/"));
        });

        $.when.apply($, promises).done(function(){
            for (var i = 0; i < arguments.length; i++) {
                orders = arguments[i][0].items
                if (orders.length > 0){
                    results.push(orders);
                }
            }

        var buytable;
        var selltable;
        $('#MarketDisplay').show();
        buytable=$('#buy').DataTable();
        buytable.rows().remove();
        selltable=$('#sell').DataTable();
        selltable.rows().remove();
        buytable.draw();
        selltable.draw();

        regionname=$("#regionSelector option:selected").text();

        $.getJSON(baseURL+"/inventory/types/"+presetTypeid+"/",function(data,status,xhr) {
            presetTypeid = data.id;
            $('#itemDescription').html("<h2><img src='https://imageserver.eveonline.com/Type/"+data.id+"_64.png'>"+data.name+"</h2><p>"+data.description+"</p>");
        });

        $.map(results,function(orderlist){
            $.map(orderlist, function(item) {
            if (item.buy === true) {
                buytable.row.add([
                    regionname,
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
                    regionname,
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
        catch(err) { console.log("No pushstate");}

        });
    }

    function loadRegionData() {
        if ($("#regionSelector").val() == 'Universe') {
            loadUniverseMarket();
            return;
        }
        $.getJSON($("#regionSelector").val(),function(data,status,xhr) {
            currentRegion=data;
            openItem(baseURL+"/inventory/types/"+presetTypeid+"/");
        });
    }

    function openItem(typehref) {
        var buytable;
        var selltable;
        $('#MarketDisplay').show();
        buytable=$('#buy').DataTable();
        buytable.rows().remove();
        selltable=$('#sell').DataTable();
        selltable.rows().remove();
        buytable.draw();
        selltable.draw();
        regionname=$("#regionSelector option:selected").text();

        $.getJSON(typehref,function(data,status,xhr) {
            $('#itemDescription').html(
                "<h2><img src='https://imageserver.eveonline.com/Type/"+data.id+"_64.png'>"+data.name+"</h2><p>"+ data.description.replace(/[\r\n]+/g, '<br>') +"</p>");

            try {
                 history.pushState(null, null, "?typeid="+data.id+"&region="+regionname);
                 presetTypeid = data.id;
            }
            catch(err) {
                console.log("No pushstate");
            }
        });

        if (typeof currentRegion != 'undefined') {
            $.getJSON(currentRegion.marketSellOrders.href+'?type='+typehref,function(data,status,xhr) {
                $.map(data.items,function(item){
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
            });

            $.getJSON(currentRegion.marketBuyOrders.href+'?type='+typehref,function(data,status,xhr) {
                $.map(data.items,function(item){
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
            })
        } else {
            alert('Set a region to get data');
        }

    }

    function setLanguage() {
        if ($("#language").val()=="Default") {
            $.cookie('market-language',null);
        } else {
            $.cookie('market-language',$("#language").val());
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

    function loadSearchCache(page=window.endpoints.marketTypes.href) {
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
        var searchString=$('#search').val().trim().replace('/','').toLowerCase();
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

    function sortByKey(array, key) {
        return array.sort(function(a, b) {
            var x = a[key]; var y = b[key];
            return ((x < y) ? -1 : ((x > y) ? 1 : 0));
        });
    }

    function ajaxSetup(token) {
        var headers = {
            "Accept": "application/json, charset=utf-8"
        };

        if ($.cookie('market-language')) {
            headers['Accept-Language'] = $.cookie('market-language');
            $('#language option[value='+ $.cookie('market-language') +']').prop('selected', true);
        }
        $.ajaxSetup({
            accepts: "application/json, charset=utf-8",
            // cache: false,
            crossDomain: true,
            type: "GET",
            dataType: "json",
            headers: headers,
            error: function (xhr, status, error) {
                displayError(error);
            }
        });
    }

    $(document).ready(function() {
        ajaxSetup(false);
        loadEndpoints();

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

        if (isFinite($.urlParam('typeid')) && ($.urlParam('typeid')!=null)) {
            presetTypeid=parseInt($.urlParam('typeid'));
        }

        if ($.urlParam('region')!=null) {
            presetRegion=decodeURIComponent($.urlParam('region'));
        }

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
        $( "#searchList" ).hide();
        $( "#MarketDisplay" ).hide();

        // https://jsfiddle.net/adamboduch/EwwEC/
        $.widget( "app.autocomplete", $.ui.autocomplete, {
            _renderItem: function( ul, item ) {
                var result = this._super( ul, item );
                result.addClass( "ui-menu-item-icon" )
                    .css( "background-image", "url(" + "https://imageserver.eveonline.com/Type/"+item.id+"_32.png" + ")" );

                return result;
            }
        });

        $(document).ajaxStart($.blockUI).ajaxStop($.unblockUI);
    });

}($, window, document));