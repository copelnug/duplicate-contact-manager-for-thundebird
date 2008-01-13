// This file is UTF-8. Please adjust you text editor prior to saving any changes!

/* Change history:
 * version 0.2
 * - don't delete exact duplicates without user interaction any more
 * - use "selected address book" instead of "personal address book only"
 *
 */
 
function wait() {}

var g_DuplicateContactsManagerBundle = null;
var g_addressBookFields = new Array(
	"DisplayName",
	"FirstName",
	"LastName",
	"PhoneticFirstName",
	"PhoneticLastName",
	"_PhoneticName",
	"NickName",
	"PrimaryEmail",
	"SecondEmail",
	"DefaultEmail",
	"CardType",
	"PreferMailFormat",
	"WorkPhone",
	"HomePhone",
	"FaxNumber",
	"PagerNumber",
	"CellularNumber",
	"WorkPhoneType",
	"HomePhoneType",
	"FaxNumberType",
	"PagerNumberType",
	"CellularNumberType",
	"HomeAddress",
	"HomeAddress2",
	"HomeCity",
	"HomeState",
	"HomeZipCode",
	"HomeCountry",
	"WorkAddress",
	"WorkAddress2",
	"WorkCity",
	"WorkState",
	"WorkZipCode",
	"WorkCountry",
	"JobTitle",
	"Department",
	"Company",
	"_AimScreenName",
	//"AnniversaryYear",
	//"AnniversaryMonth",
	//"AnniversaryDay",
	"SpouseName",
	"FamilyName",
	"DefaultAddress",
	"Category",
	"WebPage1",
	"WebPage2",
	"BirthYear",
	"BirthMonth",
	"BirthDay",
	"Custom1",
	"Custom2",
	"Custom3",
	"Custom4",
	"Notes",
	"LastModifiedDate");

var DuplicateContactsManagerDuplicateManager = {
	
	statustext: '',
	progresstext: '',
	progressmeter: null,
	window: null,
	
	//addressbook: '',
	vcards: null,
	vcardsSimplified: new Array(),
	
	abRootDir: '',
	abRdf: '',
	
	personalAddressbookURI: 'moz-abmdbdirectory://abook.mab',
	collectedAddressbookURI: 'moz-abmdbdirectory://history.mab',
	selectedAddressbookURI: null,
	personalDir: '',
	
	duplicateCache: new Object(),
	deletedCards: new Array(),
	currentSearchPosition: 0,
	currentSearchPairPosition: 0,
	
	list: null,
	displayedFields: null,
	
	foundDuplicate: false,
	finished: false,
	
	sideUsed: 'left',
	columnUseLeftRadioButton: null,
	columnUseRightRadioButton: null,
	
	directory: null,
	
	searchInterval: null,
	
	card1: null,
	currentCard1Num: null,
	
	numCardsBefore: 0,
	numCardsDeleted: 0,
	
	
	/**
	 * Will be called by duplicateEntriesWindow.xul once
	 * the according window is loaded
	 */
	init: function() {
		
		//this.normalizeNameStringTest();
		
		
		
		g_DuplicateContactsManagerBundle = document.getElementById("bundle_duplicateContactsManager");
		this.running = true;
		this.statustext = document.getElementById('duplicateStatusText_label');
		this.progresstext = document.getElementById('duplicateProgressText_label');
		this.progressmeter = document.getElementById('duplicateProgressMeter');
		this.window = document.getElementById('handleDuplicates-window');
		this.list = document.getElementById('handleDuplicatesListbox');
		this.columnUseLeftRadioButton = document.getElementById('columnUseLeft');
		this.columnUseRightRadioButton = document.getElementById('columnUseRight');
		
		this.purgeAttributesList();
		
		//this.addressbook = Components.classes["@mozilla.org/addressbook;1"].createInstance(Components.interfaces.nsIAddressBook);
		
		// We will process the selected address book
		var selectedUri = window.opener.GetSelectedDirectory();
		var matches = selectedUri.match(/(moz-abmdbdirectory:\/\/[^\/]+\.mab).*/);
		this.selectedAddressbookURI = matches[1];
		
		//if (this.selectedAddressbookURI != selectedUri) {
		//	// extracted URI is different from selected directory uri.
		//	alert(g_DuplicateContactsManagerBundle.getString('CorrectAddressBookSelectedPrompt'));
		//}
		this.readAddressBook();
		//this.searchDuplicates();
		
		if (this.numCardsBefore >= 1000) {
			alert(g_DuplicateContactsManagerBundle.getString('AlertMoreThan1000Contacts'));
		}
		
		// display address book name
		document.getElementById('addressbookname').setAttribute('value',
			this.abDir.directoryProperties.description
			//+ ' ('+ this.numCardsBefore + ' ' +
			//g_DuplicateContactsManagerBundle.getString('Contacts') + ')'
		);
		
		this.statustext.setAttribute('value', g_DuplicateContactsManagerBundle.getString('PleasePressStart'));
		
		document.getElementById('startbutton').focus();
		
	},
	
	/**
	 * Will be called by duplicateEntriesWindow.xul
	 * once the according window is closed
	 */
	OnUnloadWindow: function() {
		//alert('UnloadWindow');
		this.running = false;
		this.vcards = null;
	},
	
	skipAndSearchNextDuplicate: function() {
		this.purgeAttributesList();
		this.searchNextDuplicate();
	},
	
	startSearch: function() {
		// show progress bar
		document.getElementById('duplicateProgressMeter').setAttribute('style', 'visibility: visible');
		// hide intro info
		document.getElementById('explanation').setAttribute('style', 'display: none');
		document.getElementById('listboxpane').setAttribute('style', 'visibility: visible');
		this.purgeAttributesList();
		this.searchNextDuplicate();
	},
	
	/**
	 * Saves modification to one card and deletes the other one.
	 */
	// 2do: update LastModifiedDate
	applyAndSearchNextDuplicate: function() {
		var keepIndex = null;
		var deleteIndex = null;
		var updateFields = null;
		document.getElementById('applynextbutton').setAttribute('disabled', 'true');
		
		if (this.sideUsed == 'right') {
			// left one will be deleted
			deleteIndex = this.currentSearchPosition;
			keepIndex = this.currentSearchPairPosition;
		}
		else {
			// right one will be deleted
			deleteIndex = this.currentSearchPairPosition;
			keepIndex = this.currentSearchPosition;
		}
		updateFields = this.getCardFieldValues(this.sideUsed);
		
		// see what's been modified
		var entryModified = false;
		var keepCard = this.vcards[keepIndex].QueryInterface(Components.interfaces.nsIAbCard);
		for (var field in updateFields) {
			//alert(field + ': ' + updateFields[field]);
			if (keepCard.getCardValue(field) != updateFields[field]) {
				entryModified = true;
				//alert('Changed: ' + field + ': ' + updateFields[field]);
				try {
					keepCard.setCardValue(field, updateFields[field]);
				} catch (e) {
					alert(e);
				}
			}
		}
		if (entryModified) {
			// Try to update card in database
			try {
				//alert("Commit update: [" + abCard.displayName + "] to " + directory.directoryProperties.URI);
				keepCard.editCardToDatabase(this.directory.directoryProperties.URI);
			} catch (ex) {
				alert(ex);
			}
		}
		
		this.purgeAttributesList();
		this.deleteAbCard(deleteIndex);
		document.getElementById('applynextbutton').removeAttribute('disabled');
		
		this.searchNextDuplicate();
	},
	
	/**
	 * Deletes the card identified by 'index' from the address book.
	 */
	deleteAbCard: function(index) {
		
		this.deletedCards[index] = true;
		this.numCardsDeleted++;
		
		/** delete from directory
		 * 1) create nsISupportsArray containing the one card to be deleted
		 * 2) call deleteCards ( nsISupportsArray cards )
		 */
		var deleteCards = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
		deleteCards.AppendElement(this.vcards[index]);
		//alert('Deleting card '+index);
		this.directory.deleteCards(deleteCards);
		this.vcards[index] = false;	// set empty element, but leave element number as is
	},
	
	/**
	 * Searches the whole vcard array for a duplicate until one is found.
	 */
	 
	searchNextDuplicate: function() {
		
		this.foundDuplicate = false;
		this.currentSearchPairPosition = -1;
		if (this.skipPositionsToNext()) {
			document.getElementById('startbutton').setAttribute('disabled', 'true');
			document.getElementById('applynextbutton').setAttribute('disabled', 'true');
			document.getElementById('skipnextbutton').setAttribute('disabled', 'true');
			this.statustext.setAttribute('value', g_DuplicateContactsManagerBundle.getString('SearchingForDuplicates'));
			this.window.setAttribute('wait-cursor', 'true');
			this.searchInterval = window.setInterval("DuplicateContactsManagerDuplicateManager.searchDuplicateIntervalAction()", 0);
		}
		else {
			this.endSearch();
		}
	},
	
	
	/**
	 * performs the actual search action. Should not be called directly, but by searchNextDuplicate().
	 */
	searchDuplicateIntervalAction: function() {
		var count = 0;
		while (!this.foundDuplicate && !this.finished && count < 10) {	// execute 10 several steps per interval
			count++;
			
			// DEBUGGING
			this.progresstext.setAttribute('value', this.currentSearchPosition);
			
			if (this.currentCard1Num != this.currentSearchPosition) {
				if (this.vcards[this.currentSearchPosition]) {
					this.card1 = this.getSimplifiedCard(this.currentSearchPosition);
					this.currentCard1Num = this.currentSearchPosition;
				}
				else {
					this.endSearch();
				}
			}
			var card2 = 0;
			if (this.vcards[this.currentSearchPairPosition]) {
				card2 = this.getSimplifiedCard(this.currentSearchPairPosition);	
			}
			else {
				this.endSearch();
			}
			
			// update status every now and then
			if (1) {
				var percentage = ((this.currentSearchPosition/this.vcards.length) * 100) + '%';
				this.progressmeter.setAttribute('value', percentage);
				//this.progresstext.setAttribute('value', (this.currentSearchPosition+1) + ' '+g_DuplicateContactsManagerBundle.getString('of')+' ' + this.vcards.length);
				//this.statustext.setAttribute('value', (this.currentSearchPosition) + ':' + (this.currentSearchPairPosition));
			}
			
			/**
			 * 2do: More advanced mechanics can be used to verify if two mail addresses mean
			 * the same. For example:
			 * - if firstname_lastname@domain.tld and foo@domain.tld are available, matching
			 *   names should be checked.
			 */
			var cardsmatch = false;
			var mailmatch = false;
			var namesmatch = false;
			
			cardsmatch = this.abCardsEqual(this.card1, card2);
			if (!cardsmatch) {
				mailmatch = this.mailAdressesMatch(this.card1, card2);
				if (!mailmatch) {
					namesmatch = this.namesMatch(this.card1, card2);
				}
			}
			
			/*
			if (cardsmatch) {
				this.deleteAbCard(this.currentSearchPairPosition);
				if (!this.skipPositionsToNext()) {
					this.endSearch();
				}
			}
			else if (mailmatch || namesmatch) {
			*/
			if (cardsmatch || mailmatch || namesmatch) {
				// OK, we found something that looks like a duplicate. End loop here.
				
				// end loop
				window.clearInterval(this.searchInterval);
				
				this.foundDuplicate = true;
				
				//alert('found pair '+this.currentSearchPosition+'_'+this.currentSearchPairPosition);
				
				this.duplicateCache[this.currentSearchPosition+'_'+this.currentSearchPairPosition] = true;
				this.duplicateCache[this.currentSearchPairPosition+'_'+this.currentSearchPosition] = true;
				
				this.displayCardData(this.currentSearchPosition, this.currentSearchPairPosition);
				
				if (mailmatch) {
					this.statustext.setAttribute('value', g_DuplicateContactsManagerBundle.getString('matchingEmailAddresses'));
				}
				else {
					this.statustext.setAttribute('value', g_DuplicateContactsManagerBundle.getString('matchingNames'));
				}
				
				// enable buttons again
				document.getElementById('skipnextbutton').removeAttribute('disabled');
				document.getElementById('applynextbutton').removeAttribute('disabled');
				this.window.removeAttribute('wait-cursor');
			}
			else {
				var hasNext = this.skipPositionsToNext();
				if (!hasNext) {
					//alert('nothing left');
					this.endSearch();
				}
			}
		}
	},
	
	endSearch: function() {
		this.finished = true;
		window.clearInterval(this.searchInterval);
		//alert('endSearch() has been called.');
		this.window.removeAttribute('wait-cursor');
		//this.progresstext.setAttribute('value', g_DuplicateContactsManagerBundle.getString('finished'));
		this.statustext.setAttribute('value', g_DuplicateContactsManagerBundle.getString('finished'));
		// hide intro info
		document.getElementById('listboxpane').setAttribute('style', 'display: none');
		document.getElementById('endinfo').setAttribute('style', 'visibility: visible');
		document.getElementById('duplicateProgressMeter').setAttribute('style', 'visibility: hidden');
		document.getElementById('cancelbutton').setAttribute('label', g_DuplicateContactsManagerBundle.getString('QuitButtonLabel'));
		
		// show statistics
		document.getElementById('resultNumBefore').setAttribute('value', (document.getElementById('resultNumBefore').getAttribute('value') + "" + this.numCardsBefore));
		document.getElementById('resultNumAfter').setAttribute('value', (document.getElementById('resultNumAfter').getAttribute('value') + "" + (this.numCardsBefore - this.numCardsDeleted)));
		document.getElementById('resultNumRemoved').setAttribute('value', (document.getElementById('resultNumRemoved').getAttribute('value') + "" + this.numCardsDeleted));
		//document.getElementById('resultNumRemovedAuto').setAttribute('value', this.numCardsDeletedAuto);
		//document.getElementById('resultNumPresented').setAttribute('value', this.numCardPairsPresented);
		//document.getElementById('resultNumRemovedMan').setAttribute('value', this.numCardsDeletedManually);
		//document.getElementById('resultNumSkipped').setAttribute('value', this.numCardsSkipped);
	},
	
	
	/**
	 * increments internal pointers to next available card pair.
	 * Returns true if next pair is found.
	 * Returns false if no next pair is available
	 */
	skipPositionsToNext: function() {
		this.currentSearchPairPosition++;
		if (this.currentSearchPairPosition == this.vcards.length) {
			this.currentSearchPairPosition = 0;
			this.currentSearchPosition++;
			if (this.currentSearchPosition >= this.vcards.length) {
				// end of material.
				//alert('end of material.');
				return false;
			}
		}
		while (
				(this.currentSearchPosition == this.currentSearchPairPosition) ||
				this.deletedCards[this.currentSearchPosition] ||
				this.deletedCards[this.currentSearchPairPosition] ||
				this.duplicateCache[this.currentSearchPosition+'_'+this.currentSearchPairPosition]) {
				// recurse!
				this.skipPositionsToNext();
		}
		return true;
	},
	
	
	/**
	 * This is a simplified representation of a card from the address book with
	 * only those fields which are required for comparison, 
	 * some pre-processing already performed on the necessary fields.
	 */
	getSimplifiedCard: function(i) {
		if (!this.vcardsSimplified[i]) {
			if (this.vcards[i]) {
				var card = this.vcards[i].QueryInterface(Components.interfaces.nsIAbCard);
				var v = new Object();
				v['PrimaryEmail'] = card.getCardValue("PrimaryEmail").toLowerCase();
				v['SecondEmail'] = card.getCardValue("SecondEmail").toLowerCase();
				v['DisplayName'] = this.normalizeNameString(card.getCardValue("DisplayName"));
				v['FirstName'] = this.normalizeNameString(card.getCardValue("FirstName"));
				v['LastName'] = this.normalizeNameString(card.getCardValue("LastName"));
				this.vcardsSimplified[i] = v;
			}
		}
		return this.vcardsSimplified[i];
	},
	
	/**
	 * Creates the list with address book field for side by side comparison
	 * and editing. Editable fields will be listed in this.displayedFields.
	 */
	displayCardData: function(index1, index2) {
		var card1 = this.vcards[index1].QueryInterface(Components.interfaces.nsIAbCard);
		var card2 = this.vcards[index2].QueryInterface(Components.interfaces.nsIAbCard);
		this.purgeAttributesList();
		this.toggleContactLeftRight('left');
		this.displayedFields = new Array();
		var fieldCount = 0;
		
		// if two different mail addresses are available, show SecondEmail field
		var mail1 = card1.getCardValue('PrimaryEmail');
		var mail2 = card2.getCardValue('PrimaryEmail');
		var displaySecondMail = false;
		if (mail1 && mail2) {
			displaySecondMail = true;
		}
		
		for (var i=0; i<g_addressBookFields.length; i++) {
			// only display if at least one value is present
			var leftField = card1.getCardValue(g_addressBookFields[i]);
			var rightField = card2.getCardValue(g_addressBookFields[i]);
			if (
				(
				(g_addressBookFields[i] != 'LastModifiedDate') && 
				(leftField || rightField) &&
				// not both cards have unknown Mail Format - in this case, the field gets ignored
				!(g_addressBookFields[i]=='PreferMailFormat' && leftField=='unknown' && rightField=='unknown')
				) ||
				(g_addressBookFields[i]=='SecondEmail' && displaySecondMail)
				) {
				var row = document.createElement('listitem');
				var labelcell = document.createElement('listcell');
				var cell1 = document.createElement('listcell');
				var cell2 = document.createElement('listcell');
				
				// save field in list for later retrieval if edited values
				this.displayedFields[fieldCount] = g_addressBookFields[i];
				fieldCount++;
				
				labelcell.setAttribute('label', g_DuplicateContactsManagerBundle.getString(g_addressBookFields[i] + '_label') + ':');
				labelcell.setAttribute('class', 'fieldlabel');
				
				// highlight values that differ
				//if (leftField != rightField) {
					cell1.setAttribute('class', 'used');
					cell2.setAttribute('class', 'unused');
				//}
				
				// create input fields, depending on field type
				var cell1textbox;
				var cell2textbox;
				
				if (0) {
				// if (g_addressBookFields[i] == 'PreferMailFormat') {	// this doesn't work yet
					
					// create the PreferMailFormat menu
					cell1textbox = document.createElement('menulist');
					cell1textbox.setAttribute('disableforreadonly', 'true');
					var menu1popup = document.createElement('menupopup');
					var menu1item1 = document.createElement('menuitem');
					var menu1item2 = document.createElement('menuitem');
					var menu1item3 = document.createElement('menuitem');
					menu1item1.setAttribute('value', 'unknown');
					if (leftField == 'unknown') {
						menu1item1.setAttribute( "selected" ,"true");
					}
					menu1item2.setAttribute('value', 'plaintext');
					if (leftField == 'plaintext') {
						menu1item2.setAttribute( "selected" ,"true");
					}
					menu1item3.setAttribute('value', 'html');
					if (leftField == 'html') {
						menu1item3.setAttribute( "selected" ,"true");
					}
					menu1popup.appendChild(menu1item1);
					menu1popup.appendChild(menu1item2);
					menu1popup.appendChild(menu1item3);
					cell1textbox.appendChild(menu1popup);
					
					// right cell
					cell2textbox = document.createElement('menulist');
					cell2textbox.setAttribute('disableforreadonly', 'true');
					var menu2popup = document.createElement('menupopup');
					var menu2item1 = document.createElement('menuitem');
					var menu2item2 = document.createElement('menuitem');
					var menu2item3 = document.createElement('menuitem');
					menu2item1.setAttribute('value', 'unknown');
					if (rightField == 'unknown') {
						menu2item1.setAttribute( "selected" ,"true");
					}
					menu2item2.setAttribute('value', 'plaintext');
					if (rightField == 'plaintext') {
						menu2item2.setAttribute( "selected" ,"true");
					}
					menu2item3.setAttribute('value', 'html');
					if (rightField == 'html') {
						menu2item3.setAttribute( "selected" ,"true");
					}
					menu2popup.appendChild(menu2item1);
					menu2popup.appendChild(menu2item2);
					menu2popup.appendChild(menu2item3);
					cell2textbox.appendChild(menu2popup);
					

				}
				else {
					cell1textbox = document.createElement('textbox');
					cell2textbox = document.createElement('textbox');
				}
				
				cell1textbox.setAttribute('flex', '1');
				cell2textbox.setAttribute('flex', '1');
				cell1textbox.setAttribute('id', 'left_'+g_addressBookFields[i]);
				cell2textbox.setAttribute('id', 'right_'+g_addressBookFields[i]);
				
				if (0) {
				//if (g_addressBookFields[i] != 'PreferMailFormat') {
					// nothing
				}
				else {
					cell1textbox.setAttribute('value', leftField);
					cell2textbox.setAttribute('value', rightField);
				}
				
				var cell2applybutton = document.createElement('button');
				cell2applybutton.setAttribute('label', '<');
				cell2applybutton.setAttribute('flex', '0');
				cell2applybutton.setAttribute('class', 'borderless');
				
				// add textboxes to cells
				cell1.appendChild(cell1textbox);
				cell1.setAttribute('id', 'cell_left_'+g_addressBookFields[i]);
				//cell2.appendChild(cell2applybutton);
				cell2.appendChild(cell2textbox);
				cell2.setAttribute('id', 'cell_right_'+g_addressBookFields[i]);
				
				// add cells to row
				row.appendChild(labelcell);
				row.appendChild(cell1);
				row.appendChild(cell2);
				// add row to list
				this.list.appendChild(row);
			}
		}
	},
	
	/**
	 * Compares all email addresses in two address book cards and checks whether they are
	 * logically the same. Returns true or false.
	 *
	 * @param	String		contact 1
	 * @param	String		contact 2
	 * @return	Boolean		true if adresses match
	 */
	mailAdressesMatch: function(card1, card2) {
		var a1 = card1['PrimaryEmail'];
		var a2 = card1['SecondEmail'];
		var b1 = card2['PrimaryEmail'];
		var b2 = card2['SecondEmail'];
		
		return (a1 && (a1 == b1 || a1 == b2)) || (a2 && (a2 == b1 || a2 == b2));
	},

	/**
	 * Compares the names in two cards and returns true if they seem to match.
	 */
	namesMatch: function(card1, card2) {
		
		// lowercase strings
		var d1 	= card1['DisplayName'];
		var d2 	= card2['DisplayName'];
		var v1 	= card1['FirstName'];
		var v2 	= card2['FirstName'];
		var n1 	= card1['LastName'];
		var n2 	= card2['LastName'];
		var vn1 = card1['FirstName'] + ' ' + card1['LastName']
		var vn2 = card2['FirstName'] + ' ' + card2['LastName']
		var nv1 = card1['LastName'] + ', ' + card1['FirstName']
		var nv2 = card2['LastName'] + ', ' + card2['FirstName']
		
		// only one term needs to be true
		var namesEqual = 
		(
			((d1 && d2) && (d1 == d2)) ||								// DisplayNames vorhanden und identisch
			((n1 && n2 && v1 && v2) && (n1 == n2) && (v1 == v2)) ||		// Vor- und Nachnamen vorhanden und identscih
			(d1 && ((v2 == d1) || (n2 == d1) || (vn2 == d1))) ||		// DisplayName1 identisch mit FirstLast
			(d2 && ((v1 == d2) || (n1 == d2) || (vn1 == d2))) ||		// DisplayName2 identisch mit FirstLast
			(d1 && (d1 == nv2)) ||										// DisplayName1 identisch mit LastFirst2
			(d2 && (d2 == nv1))											// DisplayName2 identisch mit LastFirst1
		)
		
		return namesEqual;
		
		/*
		var match1 = new RegExp('/\b' + disp1 +'\b/');
		var match2 = new RegExp('/\b' + disp2 +'\b/');
		
		if (
			// DisplayNames match
			(disp1 && disp2 && (disp1 == disp2)) ||
			
			// Firstname and LastName match
			((first1 && first2 && (first1 == first2)) && (last1 && last2 && (last1 == last2))) || 
			((first2 && (first2 == first1)) && (last2 && (last2 == last1))) ||
			
			// Firstname + LastName match DisplayName
			(first1 && first2 && last1 && last2 && (first1+' '+last1 == first2+' '+last2)) || 
			(first1+' '+last1 == disp2) || 
			(first2+' '+last2 == disp1) ||
			
			// DisplayName A matches word of DisplayName B (e.g. 'peter' or 'fonda' and 'peter fonda')
			disp1.match(match2) ||
			disp2.match(match1)
			
		) {
			return true;
		}
		else 
			return false;
		*/
	},
	
	readAddressBook: function() {
		
		// Get RDF service to read address book registry
		this.abRdf = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
		this.abDir = this.abRdf.GetResource(this.selectedAddressbookURI).QueryInterface(Components.interfaces.nsIAbDirectory);
		
		if (!this.abDir.isMailList) {
			//alert(abDir.dirName);
			this.directory = this.abDir;
			this.vcards = this.getAllAbCards(this.abDir);
			this.numCardsBefore = this.vcards.length;
		}
		
	},
	
	/**
	 * Changes the selection of contacts to be used. If used without parameter, the
	 * current selection is switched. If used with "left" or "right" as parameter,
	 * the selection is changed so that the specified side will be applied.
	 */
	toggleContactLeftRight: function(side) {
		if (!side || (side != this.sideUsed)) {
			var infoLeft = document.getElementById('columnKeptInfoLeft');
			var infoRight = document.getElementById('columnKeptInfoRight');
			var sideUnused;
			if ((!side && (columnUseLeftRadioButton.getAttribute('selected') == 'true')) || side == 'right') {
				side = 'right';
				sideUnused = 'left';
				this.columnUseLeftRadioButton.setAttribute('selected', 'false');
				this.columnUseRightRadioButton.setAttribute('selected', 'true');
				document.getElementById('columnHeaderLeft').setAttribute('class', 'unused');
				document.getElementById('columnHeaderRight').setAttribute('class', 'used');
				var temp = infoLeft.getAttribute('value');
				infoLeft.setAttribute('value', infoRight.getAttribute('value'));
				infoRight.setAttribute('value', temp);
			}
			else if ((!side && (columnUseRightRadioButton.getAttribute('selected') == 'true')) || side == 'left') {
				side = 'left';
				sideUnused = 'right';
				this.columnUseLeftRadioButton.setAttribute('selected', 'true');
				this.columnUseRightRadioButton.setAttribute('selected', 'false');
				document.getElementById('columnHeaderRight').setAttribute('class', 'unused');
				document.getElementById('columnHeaderLeft').setAttribute('class', 'used');
				var temp = infoLeft.getAttribute('value');
				infoLeft.setAttribute('value', infoRight.getAttribute('value'));
				infoRight.setAttribute('value', temp);
			}
			this.sideUsed = side;
			
			for (var field in this.displayedFields) {
				document.getElementById('cell_' + side + '_' + this.displayedFields[field]).setAttribute('class', 'used');
				document.getElementById('cell_' + sideUnused + '_' + this.displayedFields[field]).setAttribute('class', 'unused');
			}
		}
	},
	
	/**
	 * Removes all rows (excluding header) from the attribute comparison listbox.
	 */
	purgeAttributesList: function() {
		for (var i = this.list.getRowCount()-1; i>=0; i--) {
			this.list.removeItemAt(i);
		}
		this.displayedFields = null;
	},
	
	/**
	 * Returns a hash with all editable fields.
	 * The parameter ('left' or 'right') specifies the column
	 * of the list to be used.
	 */
	getCardFieldValues: function(side) {
		var result = new Object();
		for (var i in this.displayedFields) {
			// textbox id is like this: 'FieldName_label'
			var id = side + '_' + this.displayedFields[i];
			//alert(id);
			result[this.displayedFields[i]] = document.getElementById(id).value;
		}
		return result;
	},
	
	/**
	 * Returns all cards from a directory in an array.
	 */
	getAllAbCards: function(directory)	{
		//alert("getAllAbCards");
		// Returns array with all vCards within given address book directory
		var abCards = new Array;
		var abCardsEnumerator;
		var counter = 0;
		
		if (directory) {
			directory = directory.QueryInterface(Components.interfaces.nsIAbDirectory);
			
			abCardsEnumerator = directory.childCards;
			if (abCardsEnumerator) {
				try {
					abCardsEnumerator.first();
				}
				catch (ex) {
					// Return empty array
					return abCards;
				}
				
				while (true) {
					var abCard = abCardsEnumerator.currentItem();
					if (abCard) {
						abCards[counter] = abCard;
						counter++;
					}
					
					try {
						abCardsEnumerator.next();
					}
					catch (ex) {
						break;
					}
				}
			}
		}
		return abCards;
	},
	
	/**
	 * Returns true if the two address book cards given as parameter
	 * are identical. Identical means that all fields with exception
	 * of "LastModifiedDate" are identical.
	 *
	 * @param	Array		Address book card 1
	 * @param	Array		Address book card 2
	 * @return	Boolean		true if cards are identical, false otherwise
	 */
	abCardsEqual: function(c1, c2) {
		var f = 0;
		while (f < g_addressBookFields.length) {
			if (g_addressBookFields[f] != 'LastModifiedDate') {
				if (c1[g_addressBookFields[f]] && !c2[g_addressBookFields[f]]) {
					return false;
				}
				else if (!c1[g_addressBookFields[f]] && c2[g_addressBookFields[f]]) {
					return false;
				}
				else if (c1[g_addressBookFields[f]] && c2[g_addressBookFields[f]] && (c1[g_addressBookFields[f]] != c2[g_addressBookFields[f]])) {
					return false;
				}
			}
			f++;
		}
		return true;
	},
	
	
	/**
	 * normalizeNameString
	 *
	 * Strips some characters from a name so that different spellings (e.g. with and
	 * without accents, can be compared. Works case insensitive.
	 *
	 * @param	String		the string to be normalized
	 * @return	String		normalized version of the string
	 */
	normalizeNameString: function(str) {
		// remove punctiation
		str = str.replace(/[\"\-\_\'\.\:\,\;\&\+]+/g, '');
		
		// replace funny letters
		str = str.replace(/[ÊÉÈËèéêëĒēĔĕĖėĘęĚě]/g, 'e');
		str = str.replace(/[ÂÁÀÃÅâáàãåĀāĂăĄąǺǻ]/g, 'a');
		str = str.replace(/[ÌÍÎÏìíîïĨĩĪīĬĭĮįİı]/g, 'i');
		str = str.replace(/[ÕØÒÓÔòóôõøŌōŎŏŐőǾǿ]/g, 'o');
		str = str.replace(/[ÙÚÛùúûŨũŪūŬŭŮůŰűŲųơƯư]/g, 'u');
		str = str.replace(/[ÝýÿŶŷŸ]/g, 'y');
		
		str = str.replace(/[ÇçĆćĈĉĊċČč]/g, 'c');
		str = str.replace(/[ÐðĎĐđ]/g, 'd');
		str = str.replace(/[ĜĝĞğĠġĢģ]/g, 'g');
		str = str.replace(/[ĤĥĦħ]/g, 'h');
		str = str.replace(/[Ĵĵ]/g, 'j');
		str = str.replace(/[Ķķĸ]/g, 'k');
		str = str.replace(/[ĹĺĻļĿŀŁł]/g, 'l');
		str = str.replace(/[ÑñŃńŅņŇňŉŊŋ]/g, 'n');
		str = str.replace(/[ŔŕŖŗŘř]/g, 'r');
		str = str.replace(/[ŚśŜŝŞşŠš]/g, 's');
		str = str.replace(/[ŢţŤťŦŧ]/g, 't');
		str = str.replace(/[Ŵŵ]/g, 'w');
		str = str.replace(/[ŹźŻżŽž]/g, 'z');
		
		// replace ligatures
		str = str.replace(/[ÄÆäæǼǽ]/g, 'ae');
		str = str.replace(/[ÖöŒœ]/g, 'oe');
		str = str.replace(/[Üü]/g, 'ue');
		str = str.replace(/[ß]/g, 'ss');
		str = str.replace(/[Ĳĳ]/g, 'ij');
		
		// remove single letters (like initials)
		str = str.replace(/ [A-Za-z0-9] /g, ' ');
		str = str.replace(/^[A-Za-z0-9] /g, '');
		str = str.replace(/ [A-Za-z0-9]$/g, '');
		
		// remove multiple white spaces
		str = str.replace(/[\s]{2,}/, ' ');
		// remove leading and trailing space
		str = str.replace(/[\s]{2,}/g, ' ');
		str = str.replace(/^[\s]+/, '');
		str = str.replace(/[\s]+$/, '');
		
		str = str.toLowerCase();
		return str;
	},
	
	/**
	 * Test method for 'normalizeNameString'
	 */
	normalizeNameStringTest: function(str) {
		var strings = new Array(
			'"Amedeo Fabrizio"',
			'Çem Özdemir',
			'Hassan J. Fadlak',
			' _sultan S.');
		for (var i in strings) {
			alert(strings[i] + ' -> '+ this.normalizeNameString(strings[i]));
		}
	}
}
