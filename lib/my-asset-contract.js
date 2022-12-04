/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';
/*
* COMP 4060 - Assignment 1
* Hantao Wang - 7860445
* This assignment implements a distributed energy market operation including add resouces
* merit order of resources, English auction and second place auction, some of the code are
* based on FabCar example and the initial contract of IBM blockchain platform 
*/
const { Contract } = require('fabric-contract-api');

class MyAssetContract extends Contract {

    async queryAllresources(ctx){
        const startKey = '';
        const endKey = '';
        const allResults = [];
        for await (const {key, value} of ctx.stub.getStateByRange(startKey, endKey)) {
            const strValue = Buffer.from(value).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
            if(record["type"] == 'resource'){
                allResults.push({ Key: key, Record: record });
            }
        }
        function ascending(a,b){
            return a.Record.price - b.Record.price;
        }
        allResults.sort(ascending);
        console.info("THIS IS ALL" + allResults);
        return JSON.stringify(allResults);
    }

    async queryAll(ctx){
        const startKey = '';
        const endKey = '';
        const allResults = [];
        for await (const {key, value} of ctx.stub.getStateByRange(startKey, endKey)) {
            const strValue = Buffer.from(value).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }         
                allResults.push({ Key: key, Record: record });
        }
        console.info("THIS IS ALL" + allResults);
        return JSON.stringify(allResults);
    }
    async StartSecondPriceAuction(ctx,myAssetId,owner){
        const offer = {
            "ResourceID":myAssetId,
            "WinnerUser":null,
            "WinnerPrice":null,
            "owner":owner,
            
            "state":'OPEN_FOR_BID',
            "type":'SecondAuction'
        };
        const exist = await this.myAssetExists(ctx,myAssetId);
        if (exist) {
            const buffer2 = Buffer.from(JSON.stringify(offer));
            await ctx.stub.putState("SecondPrice"+myAssetId,buffer2);   
        }else{
            throw new Error(`This action ${myAssetId} does not exist`);
        }
    }
    async PlaceSecondPriceBid(ctx,price,user,myAssetId){
        const exists = await this.myAssetExists(ctx, "SecondPrice"+myAssetId);
        if (!exists) {
            throw new Error(`This acution ${myAssetId} does not exist`);
        } 
        const buffer = await ctx.stub.getState("SecondPrice"+myAssetId);
        const asset = JSON.parse(buffer.toString());
        if(asset.state == 'OPEN_FOR_BID' ){
            if (asset.owner != user){
                const auctionExist = await this.myAssetExists(ctx,"SecondPriceBid"+myAssetId + user);
                if(!auctionExist){ 
                    const type = "SecondAuctionBid"+myAssetId;
                     const offer = {
                    "price":price,
                    "user":user,
                    "type":type
                };
                    const buffer2 = Buffer.from(JSON.stringify(offer));
                    await ctx.stub.putState("SecondPriceBid"+myAssetId + user, buffer2);
                    return 'bid on resouce '+ myAssetId+' placed';
            }else{
                return "You have already submit a bid"
            }
            }else{
                return "you cannot place bid on your own resource"
            }
        }else{
            return "this aucution is closed"
        }
    }
    async closeSecondPriceBid(ctx,owner,myAssetId){
        const exists = await this.myAssetExists(ctx, "SecondPrice"+myAssetId);
        if (!exists) {
            throw new Error(`The my asset ${myAssetId} does not exist`);
        }
        const buffer = await ctx.stub.getState("SecondPrice"+myAssetId);
        const auction = JSON.parse(buffer.toString());
        
        if(owner == auction.owner){
            const result = await this.GetResultSecondPriceBid(ctx,myAssetId)
            if (result != null){
                auction.WinnerPrice = result[0].Record.user;
                auction.WinnerUser = result[1].Record.price;
                auction.state = 'CLOSE_FOR_BID'
                const buffer2 = Buffer.from(JSON.stringify(auction));
                await ctx.stub.putState("SecondPrice"+myAssetId, buffer2);
                return "Winner is " + result[0].Record.user + " with " + result[1].Record.price
                // return typeof result 
            }else{
                return "No one offer a deal, auction closed"
            }          
        }
    }
    
    async GetResultSecondPriceBid(ctx,myAssetId){
        const startKey = '';
        const endKey = '';
        const allResults = [];
        for await (const {key, value} of ctx.stub.getStateByRange(startKey, endKey)) {
            const strValue = Buffer.from(value).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
            if(record["type"] == "SecondAuctionBid"+myAssetId){
                allResults.push({ Key: key, Record: record });
            }
        }
        function decending(a,b){
            return b.Record.price - a.Record.price;
        }
        allResults.sort(decending);
        return allResults;
    }

    async StartEnglishAuction(ctx,myAssetId,owner,expectPrice){
        var currentTime = new Date();
        var endTime = currentTime.setMinutes(currentTime.getMinutes()+ 5);
        const offer = {
            "ResourceID":myAssetId,
            "HighestBidUser":null,
            "HigestBidPrice":null,
            "owner":owner,
            "startTime":currentTime,
            "endTime":endTime,
            "expectPrice":expectPrice,
            "state":'OPEN_FOR_BID',
            "type":'EnglishAuction'
        };
        const exist = await this.myAssetExists(ctx,myAssetId);
        if (exist) {
            const buffer =await ctx.stub.getState(myAssetId)
            const asset = JSON.parse(buffer.toString());
            if(asset['owner'] == owner){
                const buffer2 = Buffer.from(JSON.stringify(offer));
                await ctx.stub.putState('English'+myAssetId,buffer2); 
                return "English auction created"  
            }else{
                throw new Error('You must be the owner to start auction');
            }     
        }else{
            throw new Error(`This auction is ${myAssetId} already exist`);
        }
    }

    async PlaceEnglishBid(ctx,price,user,myAssetId){
        const exists = await this.myAssetExists(ctx, "English"+myAssetId);
        if (!exists) {
            throw new Error(`This action ${myAssetId} does not exist`);
        }
        const buffer = await ctx.stub.getState("English"+myAssetId);
        const asset = JSON.parse(buffer.toString());
        if(asset.state == 'OPEN_FOR_BID'){
            if (asset.owner != user){
                var currentTime = new Date().getTime();
                if(currentTime <= asset.endTime){
                    if (Number(asset.HigestBidPrice) < Number(price) || asset.HigestBidPrice == null){
                        asset.HighestBidUser = user;
                        asset.HigestBidPrice = price
                        const buffer2 = Buffer.from(JSON.stringify(asset));
                        await ctx.stub.putState("English"+myAssetId, buffer2);
                        return 'bid on resouce '+ myAssetId+' placed';
                    }else{
                        return "Current bid "+asset.HigestBidPrice+" is higher than your bid "+price;
                    }
                }else{
                    return "bid time is over"
                }
            }else{
                return "you cannot place bid on your own resource"
            }
        }else{
            return "this aucution is closed"
        }
    }
    
    async CloseEnglishBid(ctx,myAssetId,owner){
        const exists = await this.myAssetExists(ctx, "English"+myAssetId);
        if (!exists) {
            throw new Error(`The my asset ${myAssetId} does not exist`);
        }
        const buffer = await ctx.stub.getState("English"+myAssetId);
        const auction = JSON.parse(buffer.toString());
        if(owner == auction.owner){
        auction.state = 'CLOSE_FOR_BID'
        const buffer2 = Buffer.from(JSON.stringify(auction));
        await ctx.stub.putState("English"+myAssetId, buffer2);
            if(auction.HigestBidPrice != null && auction.HighestBidUser != null){
                return "Auction winner is " + auction.HighestBidUser + " with $" + auction.HigestBidPrice
            }else if(auction.HigestBidPrice < auction.expectPrice){
                return "Auction bought-in since offer price are lower than expect"
            }else{
                return "Auction bought-in since no offer"
            }
        }
    }
    async deleteAll(ctx){
        const startKey = '';
        const endKey = '';
       
        for await (const {key, value} of ctx.stub.getStateByRange(startKey, endKey)) {
            await ctx.stub.deleteState(key);
        }
    }
    async myAssetExists(ctx, myAssetId) {
        const buffer = await ctx.stub.getState(myAssetId);
        return (!!buffer && buffer.length > 0);
    }

    async createEnergyResources(ctx,myAssetId,volume,price,owner){  
        const exist = await this.myAssetExists(ctx,myAssetId);
        if (exist) {
            throw new Error(`The my asset ${myAssetId} already exist`);
        }
        const resource = {
            "ID":myAssetId,
            "volume":volume,
            "price":price,
            "owner":owner,
            "type":'resource'
        };
        const buffer = Buffer.from(JSON.stringify(resource));
        await ctx.stub.putState(myAssetId,buffer);    
    }

}

module.exports = MyAssetContract;
