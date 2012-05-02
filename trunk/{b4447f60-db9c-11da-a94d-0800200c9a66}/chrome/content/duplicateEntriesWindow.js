// This file is UTF-8. Please adjust you text editor prior to saving any changes!
/* Change history:
 * Version 0.9 :
 * - Can now edit contacts.
 * - Auto-removal of contacts which only contain some less fields.
 * - Can work across two address books.
 * - Option to collect all potential duplicates before interacting with the user.
 * - Progress bar and other usability improvements
 * Version 0.8:
 * - Offer to delete exact duplicates without asking
 * - Correctly search for exact duplicates
 * - upgrade to support Thunderbird 7
 */

if(typeof(DuplicateContactsManager_Running) == "undefined") {
	var DuplicateEntriesWindow = {
		abManager : Components.classes["@mozilla.org/abmanager;1"].getService(Components.interfaces.nsIAbManager),
		
		stringBundle: null,

		statustext: '',
		progresstext: '',
		progressmeter: null,
		window: null,
		
		// Constants for first index of vcards arrays
		BOOK_1 : 0,
		BOOK_2 : 1,
		// Contacts. Two dimensions arrays. The first index is the adress book.
		vcards          : new Array(),
		vcardsSimplified: new Array(),

		currentSearchPosition1: 0,
		currentSearchPosition2: 0,
		deferHandling: false,
		nowHandling: false,
		duplicates: null,

		table: null,
		displayedFields: null,

		sideUsed: 'left',
		columnUseLeftRadioButton: null,
		columnUseRightRadioButton: null,

		abDir1: null,
		abDir2: null,

		card1: null,
		card2: null,

		totalCardsBefore: 0,
		totalCardsChanged: 0,
		totalCardsSkipped: 0,
		totalCardsDeleted1: 0,
		totalCardsDeleted2: 0,
		totalCardsDeletedAuto: 0,
		autoremoveDuplicates: false,
		
		selectableProperty: function(property) {
			return (property=='PreferMailFormat'
				|| property=='PreferDisplayName'
				|| property=='AllowRemoteContent');
		},

		defaultValue: function(property) {
			if (this.selectableProperty(property) || property=='PopularityIndex')
				return (property == 'PreferDisplayName' ? "1" : "0");
			else
				return "";
		},

		/**
		 * Will be called by duplicateEntriesWindow.xul once
		 * the according window is loaded
		 */
		init: function() {
			this.stringBundle = document.getElementById("bundle_duplicateContactsManager");
			this.running = true;
			this.statustext = document.getElementById('statusText_label');
			this.progresstext = document.getElementById('progressText_label');
			this.progressmeter = document.getElementById('progressMeter');
			this.window = document.getElementById('handleDuplicates-window');
			this.attributesTableRows = document.getElementById('AttributesTableRows');
			this.columnUseLeftRadioButton = document.getElementById('columnUseLeft');
			this.columnUseRightRadioButton = document.getElementById('columnUseRight');
		
			// We will process the selected address book, plus optionally a second one
			var addressbookURI1 = window.opener.GetSelectedDirectory()
				.match(/(moz-ab(mdb|osx)directory:\/\/([^\/]+\.mab|\/)).*/)[1];
			this.abDir1 = this.abManager.getDirectory(addressbookURI1);
			this.abDir2 = this.abDir1;

			// read all addressbooks, fill lists in preferences dialog
			var allAddressBooks = this.abManager.directories;
			var dirNames = new Array();
			var URIs = new Array();
			while (allAddressBooks.hasMoreElements()) {
				var addressBook = allAddressBooks.getNext();
				if (addressBook instanceof Components.interfaces.nsIAbDirectory)
				{
					dirNames.push(addressBook.dirName);
					URIs    .push(addressBook.URI);
				}
			}
			var ablists = document.getElementById("addressbooklists");
			var ablist1 = this.createMenuList("addressbookname", dirNames, URIs, addressbookURI1);
			var ablist2 = this.createMenuList("addressbookname", dirNames, URIs, addressbookURI1);
			ablists.appendChild(ablist1);
			ablists.appendChild(ablist2);

			this.hide('statusAddressBook1');
			this.hide('statusAddressBook2');
			this.statustext.setAttribute('value', this.stringBundle.getString('PleasePressStart'));
			document.getElementById('startbutton').focus();
		},

		/**
		 * Will be called by duplicateEntriesWindow.xul
		 * once the according window is closed
		 */
		OnUnloadWindow: function() {
			this.running = false;
			this.vcards[this.BOOK_1] = null;
			this.vcards[this.BOOK_2] = null;
		},

		startSearch: function() {
			var ablist1 = document.getElementById("addressbooklists").firstChild;
			var ablist2 = ablist1.nextSibling;
			if (ablist1.selectedItem) this.abDir1 = this.abManager.getDirectory(ablist1.selectedItem.value);
			if (ablist2.selectedItem) this.abDir2 = this.abManager.getDirectory(ablist2.selectedItem.value);
			if([ablist1.selectedItem.value, ablist2.selectedItem.value].indexOf("moz-abosxdirectory:///") >= 0)
				alert("Mac OS X Address Book is read-only.\nYou can use it only for comparison.");
			//It seems that Thunderbird 11 on Max OS 10.7 can actually be write fields, although an exception is thrown.
			this.readAddressBooks();
	
			this.autoremoveDuplicates = document.getElementById("autoremove").hasAttribute("checked");
			this.deferHandling = document.getElementById("deferhandling").hasAttribute("checked");
			// hide intro info, show table, progress, etc.
			this.hide('explanation');
			this.purgeAttributesTable();
			this.show('tablepane');
			this.hide('endinfo');
			this.show('progressMeter');
			this.statustext.setAttribute('value', this.stringBundle.getString('SearchingForDuplicates'));
			document.getElementById('statusAddressBook1_label').setAttribute('value', this.abDir1.dirName);
			document.getElementById('statusAddressBook2_label').setAttribute('value', this.abDir2.dirName);
			this.updateDeletedProgress('statusAddressBook1_size' , this.BOOK_1, 0);
			this.updateDeletedProgress('statusAddressBook2_size' , this.BOOK_2, 0);
			this.show('statusAddressBook1');
			this.show('statusAddressBook2');
			this.show('stopbutton');
			this.hide('quitbutton');

			// re-initialization needed in case of re-start:
			this.currentSearchPosition1 = 0;
			this.currentSearchPosition2 = (this.abDir1 == this.abDir2 ? 0 : -1);
			this.nowHandling = false;
			this.duplicates = new Array();
			this.totalCardsChanged = 0;
			this.totalCardsSkipped = 0;
			this.totalCardsDeleted1 = 0;
			this.totalCardsDeleted2 = 0;
			this.totalCardsDeletedAuto = 0;
			this.updateProgress();
			this.searchNextDuplicate();
		},

		skipAndSearchNextDuplicate: function() {
			this.totalCardsSkipped++;
			this.searchNextDuplicate();
		},

		/**
		 * Continues searching the whole vcard array for a duplicate until one is found.
		 */
		searchNextDuplicate: function() {
			this.disable('startbutton');
			this.purgeAttributesTable();

			this.disable('skipnextbutton');
			this.disable('applynextbutton');
			this.window.setAttribute('wait-cursor', 'true');
			this.statustext.setAttribute('value', this.stringBundle.getString('SearchingForDuplicates'));
			this.updateProgress();
			// starting the search via setTimeout allows redrawing the progress info
			setTimeout(function() { DuplicateEntriesWindow.searchDuplicateIntervalAction(); }, 13);
		},

		/**
		 * Saves modification to one card and deletes the other one.
		 */
		// TODO: update LastModifiedDate
		applyAndSearchNextDuplicate: function() {
			var keptIndex = null;
			var deletedIndex = null;
			var keptBook = null;
			var deletedBook = null;
	
			if (this.sideUsed == 'right') {
				// left one will be deleted
				deletedAbDir  = this.abDir1;
				deletedBook   = this.BOOK_1;
				deletedIndex  = this.currentSearchPosition1;
				keptAbDir     = this.abDir2;
				keptBook      = this.BOOK_2;
				keptIndex     = this.currentSearchPosition2;
			}
			else {
				// right one will be deleted
				deletedAbDir  = this.abDir2;
				deletedBook   = this.BOOK_2;
				deletedIndex  = this.currentSearchPosition2;
				keptAbDir     = this.abDir1;
				keptBook      = this.BOOK_1;
				keptIndex     = this.currentSearchPosition1;
			}
			var updateFields = this.getCardFieldValues(this.sideUsed);
			var keptCard = this.vcards[keptBook][keptIndex];
			var displayName = this.getProperty(keptCard, 'DisplayName');

			// see what's been modified
			var entryModified = false;
			for (var property in updateFields) {
				var defaultValue = this.defaultValue(property);
				if (keptCard.getProperty(property, defaultValue)!= updateFields[property]) {
						// not using this.getProperty here to give a chance to update wrongly empty field
					entryModified = true;
					try {
						keptCard.setProperty(property, updateFields[property]);
					} catch (e) {
						alert("Internal error: cannot set property '"+property+"' of "+displayName+": "+e);
					}
				}
			}
			if (entryModified) {
				this.vcardsSimplified[keptBook][keptIndex] = null; // request reconstruction by getNormalizedCard
				try {
					keptAbDir.modifyCard(keptCard);
					this.totalCardsChanged++;
				} catch (e) {
					alert("Internal error: cannot update card '"+displayName+"': "+e);
				}
			}
	
			this.deleteAbCard(deletedAbDir, deletedBook, deletedIndex, false);
			this.searchNextDuplicate();
		},

		/**
		 * Deletes the card identified by 'index' from the given address book.
		 */
		deleteAbCard: function(abDir, book, index, auto) {
	
			var card = this.vcards[book][index];
			var displayName = this.getProperty(card, 'DisplayName');

			/** delete from directory
			 * 1) create nsISupportsArray containing the one card to be deleted
			 * 2) call deleteCards ( nsISupportsArray cards )
			 */
			var deleteCards = Components.classes["@mozilla.org/array;1"].createInstance(Components.interfaces.nsIMutableArray);
			deleteCards.appendElement(card, false);
			try {
				abDir.deleteCards(deleteCards);
				if (abDir == this.abDir1)
					this.totalCardsDeleted1++;
				else
					this.totalCardsDeleted2++;
				if(auto)
					this.totalCardsDeletedAuto++;
			} catch (e) {
				alert("Internal error: cannot remove card '"+displayName+"': "+e);
			}
			this.vcards[book][index] = null;	// set empty element, but leave element number as is
		},

		updateDeletedProgress: function (label, book, nDeleted) {
			document.getElementById(label).setAttribute('value', '('+ (this.vcards[book].length -
					(this.abDir1 == this.abDir2 ? this.totalCardsDeleted1 + this.totalCardsDeleted2 : nDeleted)) +')');
		},

		updateProgress: function() {
			// update status info - will not be visible immediately, see also http://forums.mozillazine.org/viewtopic.php?p=5300605
			var pos = this.currentSearchPosition1 + 1;
			var len = this.vcards[this.BOOK_1].length;
			this.progressmeter.setAttribute('value', ((pos / len) * 100) + '%');
			this.progresstext.setAttribute('value', pos);
			this.updateDeletedProgress('statusAddressBook1_size' , this.BOOK_1, this.totalCardsDeleted1);
			this.updateDeletedProgress('statusAddressBook2_size' , this.BOOK_2, this.totalCardsDeleted2);
		},

		/**
		 * advances internal pointers to next available card pair.
		 * Returns true if and only if next pair is available
		 */
		skipPositionsToNext: function() {
			if(!this.deferHandling || !this.nowHandling) {
				if (this.searchPositionsToNext())
					return true;
				if (!this.deferHandling)
					return false;
				this.nowHandling = true;
			}
			if(this.duplicates.length > 0) {
				[this.currentSearchPosition1, this.currentSearchPosition2] = this.duplicates.shift();
				this.updateProgress();
				return true;
			}
			else
				return false;
		},

		/**
		 * increments internal pointers to next available card pair.
		 * Returns true if and only if next pair is available
		 */
		searchPositionsToNext: function() {
			// If the current searchPosition is deleted, force the search for a next one by
			// setting the searchPosition2 to the end.
			if(!this.vcards[this.BOOK_1][this.currentSearchPosition1])
				this.currentSearchPosition2 = this.vcards[this.BOOK_2].length;

			// Search for the next searchPosition2
			do
			{
				++(this.currentSearchPosition2);
				if(this.currentSearchPosition2 >= this.vcards[this.BOOK_2].length)
				{
					// We have reached the end, search for the next searchPosition
					do
					{
						++(this.currentSearchPosition1);
						this.updateProgress();
						// if same book, make sure it's possible to have ...,Position1, Position2.
						if(this.currentSearchPosition1 + (this.abDir1 == this.abDir2 ? 1 : 0) >= this.vcards[this.BOOK_1].length)
							return false;
					} while(!this.vcards[this.BOOK_1][this.currentSearchPosition1]);

					// if same book, we start searching the pair with the position after.
					this.currentSearchPosition2 = (this.abDir1 == this.abDir2 ? this.currentSearchPosition1 + 1 : 0);
				}
			} while(!this.vcards[this.BOOK_2][this.currentSearchPosition2]);

			return true;
		},

		/**
		 * performs the actual search action. Should not be called directly, but by searchNextDuplicate().
		 */
		searchDuplicateIntervalAction: function() {
			var lasttime = new Date;
			while (this.skipPositionsToNext()) {
				if((new Date)-lasttime >= 1000) {
					// Force/enable Thunderbird every 1000 milliseconds to redraw the progress bar etc.
					// See also http://stackoverflow.com/questions/2592335/how-to-report-progress-of-a-javascript-function
					// As a nice side effect, this allows the stop button to take effect while this main loop is active!
					setTimeout(function() { DuplicateEntriesWindow.searchDuplicateIntervalAction(); }, 13);
					return;
				}
		
				this.card1 = this.getNormalizedCard(this.BOOK_1, this.currentSearchPosition1);
				this.card2 = this.getNormalizedCard(this.BOOK_2, this.currentSearchPosition2);	
				var mailmatch = this.mailAddressesMatch(this.card1, this.card2);
				var namesmatch = this.namesMatch(this.card1, this.card2);
				var	cardscompare = this.abCardsCompare(
					this.vcards[this.BOOK_1][this.currentSearchPosition1], 
					this.vcards[this.BOOK_2][this.currentSearchPosition2]
				);

				if (cardscompare != 0 && this.autoremoveDuplicates) {
					if (cardscompare < 0)
						this.deleteAbCard(this.abDir1, this.BOOK_1, this.currentSearchPosition1, true);
					else
						this.deleteAbCard(this.abDir2, this.BOOK_2, this.currentSearchPosition2, true);
				}
				else if (mailmatch || namesmatch) {
					// OK, we found something that looks like a duplicate.
					//window.clearInterval(this.searchInterval);

					if (this.deferHandling && !this.nowHandling) { // append the positions to queue
						this.duplicates.push([this.currentSearchPosition1, this.currentSearchPosition2]);
					}
					else {
						// enable buttons again
						this.enable('skipnextbutton' );
						this.enable('applynextbutton');
						this.window.removeAttribute('wait-cursor');
						this.statustext.setAttribute('value', this.stringBundle.getString(
							mailmatch ? 'matchingEmailAddresses' : 'matchingNames'));
						this.displayCardData(this.currentSearchPosition1, this.currentSearchPosition2, cardscompare);
						return;
					}
				}
			}
			this.endSearch();
		},

		endSearch: function() {
			// hide table etc.
			this.hide('tablepane');
			this.hide('progressMeter');

			this.disable('skipnextbutton');
			this.disable('applynextbutton');
			this.window.removeAttribute('wait-cursor');
			this.progresstext.setAttribute('value', "");
			this.statustext.setAttribute('value', this.stringBundle.getString('finished'));
	
			// show statistics
			var totalCardsDeleted = this.totalCardsDeleted1+this.totalCardsDeleted2;
			document.getElementById('resultNumBefore').setAttribute('value', this.totalCardsBefore);
			document.getElementById('resultNumAfter').setAttribute('value', this.totalCardsBefore - totalCardsDeleted);
			document.getElementById('resultNumRemovedMan').setAttribute('value', totalCardsDeleted - this.totalCardsDeletedAuto);
			document.getElementById('resultNumRemovedAuto').setAttribute('value', this.totalCardsDeletedAuto);
			document.getElementById('resultNumChanged').setAttribute('value', this.totalCardsChanged);
			document.getElementById('resultNumSkipped').setAttribute('value', this.totalCardsSkipped);
			this.show('endinfo');
			this.hide('stopbutton');
			this.show('quitbutton');

			this.enable('startbutton');
		},

		getProperty: function(card, property) {
			var defaultValue = this.defaultValue(property);
			var value = card.getProperty(property, defaultValue);
			if (value == "" && this.selectableProperty(property))
				return defaultValue; // recover from wrongly empty field
			else
				return value+""; // force string even for e.g. PopularityIndex
		},

		normalizeMiddlePrefixName: function(fn, ln) {
			var p = null;
			// move any wrongly attached middle initial(s) from last name to first name
			var middlenames = "";
			while (p = ln.match(/^\s*([A-Za-z])\s+(.*)$/)) {
				middlenames += " "+p[1];
				ln = p[2];
			}
			// move any wrongly attached name prefix(es) from first name to last name
			var nameprefixes = "";
			while (p = fn.match(/^(.+)\s(von|van|und|and|für|for|zur|der|de|geb|ben)\s*$/)) {
				fn = p[1];
				nameprefixes = p[2]+" "+nameprefixes;
			}
			fn = fn.replace(/^\s+/, "").replace(/\s+$/, "") + middlenames;
			ln = nameprefixes + ln.replace(/^\s+/, "").replace(/\s+$/, "");
			return [fn, ln];
		},

		getAbstractedProperty: function(card, property) {
			var defaultValue = this.defaultValue(property);
			if (property == "UUID" ||
					property == "UID" || 
					property == 'RecordKey' || 
					property == 'DbRowID'   ||
					property == 'PhotoType' ||
					property == 'LowercasePrimaryEmail' ||
					property == 'LastModifiedDate')
				return defaultValue; // do not use these for comparison
			var value = this.getProperty(card, property);
			if (property == 'PhotoURI' && value =='chrome://messenger/skin/addressbook/icons/contact-generic.png')
				return defaultValue;
			if (property == 'PrimaryEmail' || property == 'SecondEmail')
				return value.replace(/@googlemail.com$/ig,"@gmail.com");
				
			if (property == 'FirstName' || property == 'LastName' || property == 'DisplayName') {
				if (   value == this.getProperty(card, 'PrimaryEmail') || value == this.getProperty(card,  'SecondEmail'))
					return defaultValue; // correct typical automatic copy mistake of email clients
				var p = null;
				if (property == 'DisplayName') {
					value = value.replace(/[\s]{2,}/g, ' '); // remove any multiple white spaces
					// normalize order of first and last name
					if (p = value.match(/^([^,]+),\s+(.+)$/)) {
						[fn, ln] = this.normalizeMiddlePrefixName(p[2], p[1]);
						value = fn + " " + ln;
					}
					return value;
				}
				var fn = this.getProperty(card, 'FirstName');
				var ln = this.getProperty(card,  'LastName');
				// correct order of first and last name
				if (/,\s*$/.test(fn)) {
					ln = fn.replace(/,\s*$/,"");
					fn = this.getProperty(card,  'LastName');
				}
				else {
					if (p = fn.match(/^([^,]+),\s+(.+)$/)) {
						fn = p[2]+(ln != "" ? " "+ln : "");
						ln = p[1];
				}
				}
				[fn, ln] = this.normalizeMiddlePrefixName(fn, ln);
				return (property == 'FirstName' ? fn : ln);
			}
			return value;
		},

		/**
		 * This is a simplified representation of a card from the address book with
		 * only those fields which are required for comparison, 
		 * some pre-processing already performed on the necessary fields.
		 */
		getNormalizedCard: function(book, i) {
			if (!this.vcardsSimplified[book][i]) {
				if (this.vcards[book][i]) {
					var card = this.vcards[book][i].QueryInterface(Components.interfaces.nsIAbCard);
					var v = new Object();
					v['PrimaryEmail'] = this.normalize(this.getAbstractedProperty(card,'PrimaryEmail'));
					v['SecondEmail' ] = this.normalize(this.getAbstractedProperty(card, 'SecondEmail'));
					v['DisplayName' ] = this.simplifyName(this.getAbstractedProperty(card,'DisplayName')).toLowerCase();
					v['FirstName'   ] = this.simplifyName(this.getAbstractedProperty(card,  'FirstName')).toLowerCase();
					v[ 'LastName'   ] = this.simplifyName(this.getAbstractedProperty(card,   'LastName')).toLowerCase();
					this.vcardsSimplified[book][i] = v;
				}
			}
			return this.vcardsSimplified[book][i];
		},

		/**
		 * Creates the table with address book field for side by side comparison
		 * and editing. Editable fields will be listed in this.displayedFields.
		 */
		displayCardData: function(index1, index2, cardscompare) {
			var card1 = this.vcards[this.BOOK_1][index1].QueryInterface(Components.interfaces.nsIAbCard);
			var card2 = this.vcards[this.BOOK_2][index2].QueryInterface(Components.interfaces.nsIAbCard);
			this.purgeAttributesTable();
			this.toggleContactLeftRight(cardscompare == -1 ? 'right' : 'left');
			this.displayedFields = new Array();
			var fieldCount = 0;
	
			// if two different mail primary addresses are available, show SecondEmail field such that it can be filled in
			var mail1 = this.normalize(this.getAbstractedProperty(card1,'PrimaryEmail'));
			var mail2 = this.normalize(this.getAbstractedProperty(card2,'PrimaryEmail'));
			var displaySecondMail = (mail1 != '' && mail2 != '' && mail1 != mail2);
			// if combination of first and last name is different from display name, show nickname field such that it can be filled in
			var dn1 = this.normalize(this.getAbstractedProperty(card1,'DisplayName'));
			var dn2 = this.normalize(this.getAbstractedProperty(card2,'DisplayName'));
			var displayNickName = (dn1 != '' && dn1 != this.normalize(this.getAbstractedProperty(card1,'FirstName'))+" "+
				this.normalize(this.getAbstractedProperty(card1, 'LastName')))
				|| (dn2 != '' && dn2 != this.normalize(this.getAbstractedProperty(card2,'FirstName'))+" "+
				this.normalize(this.getAbstractedProperty(card2, 'LastName')))
				|| (dn1 != dn2);
	
			var fields = this.addressBookFields;
			this.make_visible('tableheader');
			for (var i=0; i<fields.length; i++) {
				var property = fields[i];
				var defaultValue = this.defaultValue(property);
				var  leftValue = this.getProperty(card1, property);
				var rightValue = this.getProperty(card2, property);
				if (	// only display if at least one value is present
						 (leftValue != defaultValue || rightValue != defaultValue )
					  || (property=='SecondEmail' && displaySecondMail)
					  || (property=='NickName'    && displayNickName)
					  || property=='Notes' || property=='PreferDisplayName' // always show these fields
				   ) {
					// save field in list for later retrieval if edited values
					this.displayedFields[fieldCount] = property;
					fieldCount++;
			
					var row = document.createElement('row');
					var labelcell = document.createElement('label');
					try {
						labelcell.setAttribute('value', this.stringBundle.getString(property + '_label') + ':');
					}
					catch (e) {
						alert("Internal error: cannot get localized field name for "+property+": "+e);
					}
					labelcell.setAttribute('class', 'field');
			
					var cell1 = document.createElement('hbox');
					var cell2 = document.createElement('hbox');
			
					// highlight values that differ
					if (leftValue != rightValue) {
						cell1.setAttribute('class', this.sideUsed == 'left' ? 'used' : 'unused');
						cell2.setAttribute('class', this.sideUsed == 'left' ? 'unused' : 'used');
					}
			
					// create input fields, depending on field type
					var cell1valuebox;
					var cell2valuebox;
			
					if (this.selectableProperty(property)) {
						if (property == 'PreferMailFormat') {
							labels = [this.stringBundle.getString('unknown_label'), 
												this.stringBundle.getString('plaintext_label'),
												this.stringBundle.getString('html_label')];
						}
						else {
							labels = [this.stringBundle.getString('false_label'), 
												this.stringBundle.getString('true_label')];
						}
						values = [0, 1, 2];
						cell1valuebox = this.createMenuList(null, labels, values,  leftValue, true);
						cell2valuebox = this.createMenuList(null, labels, values, rightValue, true);
					}
					else {
						cell1valuebox = document.createElement('textbox');
						cell2valuebox = document.createElement('textbox');
						cell1valuebox.setAttribute('value',  leftValue);
						cell2valuebox.setAttribute('value', rightValue);
					}
			
					cell1valuebox.setAttribute('flex', '2');
					cell2valuebox.setAttribute('flex', '2');
					cell1valuebox.setAttribute('id',  'left_'+property);
					cell2valuebox.setAttribute('id', 'right_'+property);
			
					// add valueboxes to cells
					cell1.appendChild(cell1valuebox);
					cell1.setAttribute('id', 'cell_left_' +property);
					cell2.appendChild(cell2valuebox);
					cell2.setAttribute('id', 'cell_right_'+property);
			
					// add cells to row
					row.appendChild(labelcell);
					row.appendChild(cell1);
					row.appendChild(cell2);
			
					// add row to table
					this.attributesTableRows.appendChild(row);
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
		/**
		 * TODO: More advanced mechanics can be used to verify if two mail addresses mean
		 * the same. For example:
		 * - if firstname_lastname@domain.tld and foo@domain.tld are available, matching
		 *   names should be checked.
		 */
		mailAddressesMatch: function(card1, card2) {
			var a1 = card1['PrimaryEmail'];
			var a2 = card1['SecondEmail'];
			var b1 = card2['PrimaryEmail'];
			var b2 = card2['SecondEmail'];
			return ((a1 != "" && (a1 == b1 || a1 == b2)) || 
					    (a2 != "" && (a2 == b1 || a2 == b2)) );
		},

		/**
		 * Returns first, last, and display name,
		 * completing them if needed (and easily possible) from DisplayName, PrimaryEmail, and SecondEmail
		 */
		completeFirstLastDisplayName: function(card) {
			var fn = card[  'FirstName'];
			var ln = card[   'LastName'];
			var dn = card['DisplayName'];
			if (dn == "" && fn != "" && ln != "")
				dn = fn+" "+ln;
			else if (fn == "" || ln == "" || dn == "") {
				function matchFirstLastEmail(email) {
				var p = email.match(/^\s*([A-Za-z0-9_\x80-\uFFFF]+)[\.\-_]+([A-Za-z0-9_\x80-\uFFFF]+)@/);
					if(!p) // second attempt only works if email has not been converted to lower-case:
						p = email.match(/^\s*([A-Z][a-z0-9_\x80-\uFFFF]*)([A-Z][a-z0-9_\x80-\uFFFF]*)@/);
					return p;
				}
				var p = card['DisplayName' ].match(/^\s*([A-Za-z0-9_\x80-\uFFFF]+)\s+([A-Za-z0-9_\x80-\uFFFF]+)\s*$/);
				if(!p) 
					p = matchFirstLastEmail(card['PrimaryEmail']);
				if(!p) 
					p = matchFirstLastEmail(card[ 'SecondEmail']);
				if (p) {
					if (fn == "")
						fn = p[1];
					if (ln == "")
						ln = p[2];
					if (dn == "")
						dn = p[1]+" "+p[2];
				}
			}
			return [fn, ln, dn];
		},

		/**
		 * Compares the names in two cards and returns true if they seem to match.
		 */
		namesMatch: function(card1, card2) {
			// strings are already lowercase and normalized
			var [f1, l1, d1] = this.completeFirstLastDisplayName(card1);
			var [f2, l2, d2] = this.completeFirstLastDisplayName(card2);
			return ((d1 != "" &&             d1 == d2            ) ||	// DisplayNames exist and equal
					(f1 != "" && l1 != "" && f1 == f2 && l1 == l2) );	// FirstName and LastName exist and equal
		},

		readAddressBooks: function() {
			if (!this.abDir1.isMailList) {
				this.vcards[this.BOOK_1] = this.getAllAbCards(this.abDir1);
				this.vcardsSimplified[this.BOOK_1] = new Array();
				this.totalCardsBefore = this.vcards[this.BOOK_1].length;
			}
			if (this.abDir2 != this.abDir1 && !this.abDir2.isMailList) {
				// we compare two (different) address books
				this.vcards[this.BOOK_2] = this.getAllAbCards(this.abDir2);
				this.vcardsSimplified[this.BOOK_2] = new Array();
				this.totalCardsBefore += this.vcards[this.BOOK_2].length;
			}
			else {
				// we operate on a single address book
				this.vcards[this.BOOK_2] = this.vcards[this.BOOK_1];
				this.vcardsSimplified[this.BOOK_2] = this.vcardsSimplified[this.BOOK_1];
			}
	
		},

		/**
		 * Changes the selection of contacts to be used. If used without parameter, the
		 * current selection is switched. If used with "left" or "right" as parameter,
		 * the selection is changed so that the specified side will be applied.
		 */
		toggleContactLeftRight: function(side) {
			if (!side || (side != this.sideUsed)) {
				var infoLeft  = document.getElementById('columnKeptInfoLeft');
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
					var cell1 = document.getElementById('cell_' + side + '_' + this.displayedFields[field]);
					var cell2 = document.getElementById('cell_' + sideUnused + '_' + this.displayedFields[field]);
					if (cell1.getAttribute('class') == 'unused') {
						  cell1.setAttribute('class', 'used');
					}
					if (cell2.getAttribute('class') == 'used') {
						  cell2.setAttribute('class', 'unused');
					}
				}
			}
		},

		/**
		 * Removes all rows (excluding header) from the attribute comparison table.
		 */
		purgeAttributesTable: function() {
			this.make_invisible('tableheader');
			while(this.attributesTableRows.firstChild.nextSibling) {
				this.attributesTableRows.removeChild(this.attributesTableRows.firstChild.nextSibling);
			}
			this.displayedFields = null;
		},

		/**
		 * Returns a hash with all editable fields.
		 * The parameter ('left' or 'right') specifies the column
		 * of the table to be used.
		 */
		getCardFieldValues: function(side) {
			var result = new Object();
			for (var i in this.displayedFields) {
				// valuebox id is like this: 'left_FieldName'
				var id = side + '_' + this.displayedFields[i];
				var valuebox = document.getElementById(id);
				result[this.displayedFields[i]] = (valuebox.selectedItem ? valuebox.selectedItem.value : valuebox.value);
			}
			return result;
		},

		/**
		 * Returns all cards from a directory in an array.
		 */
		getAllAbCards: function(directory)	{
			// Returns array with all vCards within given address book directory
			var abCards = new Array;
			var abCardsEnumerator;
			var counter = 0;
	
			if (directory) {
				abCardsEnumerator = directory.QueryInterface(Components.interfaces.nsIAbDirectory).childCards;
				if (abCardsEnumerator) {
					try {
						while (abCardsEnumerator.hasMoreElements()) {
							var abCard = abCardsEnumerator.getNext();
							if (abCard != null &&
									abCard instanceof Components.interfaces.nsIAbCard && !abCard.isMailList) {
								abCards[counter++] = abCard;
							}
						}
					}
					catch (ex) {
						// Return empty array
						return abCards;
					}
				}
			}
			return abCards;
		},

		propertyUnion: function(c1, c2) {
			var union = new Array();
			for (var i = 0; i < 2; i++) {
				var it = i == 0 ? c1.properties : c2.properties;
				while (it.hasMoreElements()) {
					var property = it.getNext().QueryInterface(Components.interfaces.nsIProperty).name;
					if (union.indexOf(property) < 0)
						union.push(property);
				}
			}
			return union;
		},

		/**
		 * @param	Array		Address book card 1
		 * @param	Array		Address book card 2
		 * @return +1 if first card is more complete then second one or identical
		 *         -1 if first card is less complete than second one
		 *          0 otherwise (that is, cards as incomparable)
		 */
		abCardsCompare: function(c1, c2) {
			var c1_less_complete = true;
			var c2_less_complete = true;
			var c1_charweight = 0;
			var c2_charweight = 0;
			var props = this.propertyUnion(c1, c2);
			for (var i = 0; i < props.length; i++) {
				var property = props[i];
				if (property == 'SecondEmail')
					continue; // will be treated along with PrimaryEmail
				var str1 = this.getAbstractedProperty(c1, property);
				var str2 = this.getAbstractedProperty(c2, property);
				value1 = this.normalize(str1);
				value2 = this.normalize(str2);
				// charweight used to give preference to values with many uppercase and special characters
				c1_charweight += str1.replace(/[a-z]/g, '').length;
				c2_charweight += str2.replace(/[a-z]/g, '').length;
				if (property == 'PrimaryEmail') {
					// treat both email addresses as equivalent, i.e., treat them as a set
					var secondvalue1 = this.getAbstractedProperty(c1, 'SecondEmail');
					var secondvalue2 = this.getAbstractedProperty(c2, 'SecondEmail');
					function setOf(s1, s2) {
						if (s1 == '')
							return s2;
						else if (s2 == '' || s2 == s1)
							return s1;
						else
							return (s1<s2 ? s1+" "+s2 : s2+" "+s1);
					}
					value1 = setOf(value1, secondvalue1);
					value2 = setOf(value2, secondvalue2);
				}
				var defaultValue = this.defaultValue(property);
				if (value1 != value2) {
					if (value2 == defaultValue)
						c1_less_complete = false;
					else if (value1 == defaultValue)
						c2_less_complete = false;
					else {
						if (property == 'PopularityIndex') {
							if (value1 > value2)
								c1_less_complete = false;
							else
								c2_less_complete = false;
						}
						else if (property == 'DisplayName' || property == 'LastName' || 
										 property == 'PrimaryEmail') {// treat both email addresses as equivalent, i.e., treat them as a set
							if      (value1.indexOf(value2)>=0) // name in c2 is substring of name in c1
								c1_less_complete = false;
							else if (value2.indexOf(value1)>=0) // name in c1 is substring of name in c2
								c2_less_complete = false;
							else
								return 0;
						}
						else {
							return 0;
						}
					}
					if(!c1_less_complete && !c2_less_complete)
						return 0;
				}
			}
			if (c1_less_complete && c2_less_complete) {// identical modulo normalization
				if (c1_charweight > c2_charweight) return  1;
				if (c2_charweight > c1_charweight) return -1;
			}
			return (c2_less_complete ? 1 : -1); // if identical, prefer c2 as having "less information"
		},
					
		enable: function(id) {
			document.getElementById(id).setAttribute('disabled', 'false');
		},
		disable: function(id) {
			document.getElementById(id).setAttribute('disabled', 'true');
		},
					
		show: function(id) {
			document.getElementById(id).setAttribute('style', 'display: block');
		},
		hide: function(id) {
			document.getElementById(id).setAttribute('style', 'display: none');
		},
				
		make_visible: function(id) {
			document.getElementById(id).setAttribute('style', 'visibility: visible');
		},
		make_invisible: function(id) {
			document.getElementById(id).setAttribute('style', 'visibility: hidden');
		},
		
		normalize : function(text) {
			return text
			// expand umlauts and ligatures
			  .replace(/[ÄÆäæǼǽ]/g, 'ae')
			  .replace(/[ÖöŒœ]/g, 'oe')
			  .replace(/[Üü]/g, 'ue')
			  .replace(/[ß]/g, 'ss')
			  .replace(/[Ĳĳ]/g, 'ij')
			// remove multiple white spaces
				.replace(/[\s]{2,}/g, ' ')
			// remove leading and trailing space
				.replace(/^\s+/, "")
				.replace(/\s+$/, "")
				.toLowerCase();
		},
				
		/**
		 * simplifyName
		 *
		 * Strips some characters from a name so that different spellings (e.g. with and
		 * without accents, can be compared. Works case insensitive.
		 *
		 * @param	text		the string to be normalized
		 * @return	String		simplified version of the string
		 */
		simplifyName : function(text) {

			return text
			// remove punctiation
			  .replace(/[\"\'\-_:,;\.\&\+]+/g, '')
			
			// replace funny letters
			  .replace(/[ÂÁÀÃÅâáàãåĀāĂăĄąǺǻ]/g, 'a')
			  .replace(/[ÊÉÈËèéêëĒēĔĕĖėĘęĚě]/g, 'e')
			  .replace(/[ÌÍÎÏìíîïĨĩĪīĬĭĮįİı]/g, 'i')
			  .replace(/[ÕØÒÓÔòóôõøŌōŎŏŐőǾǿ]/g, 'o')
			  .replace(/[ÙÚÛùúûŨũŪūŬŭŮůŰűŲųơƯư]/g, 'u')
			  .replace(/[ÝýÿŶŷŸ]/g, 'y')
			
			  .replace(/[ÇçĆćĈĉĊċČč]/g, 'c')
			  .replace(/[ÐðĎĐđ]/g, 'd')
			  .replace(/[ĜĝĞğĠġĢģ]/g, 'g')
			  .replace(/[ĤĥĦħ]/g, 'h')
			  .replace(/[Ĵĵ]/g, 'j')
			  .replace(/[Ķķĸ]/g, 'k')
			  .replace(/[ĹĺĻļĿŀŁł]/g, 'l')
			  .replace(/[ÑñŃńŅņŇňŉŊŋ]/g, 'n')
			  .replace(/[ŔŕŖŗŘř]/g, 'r')
			  .replace(/[ŚśŜŝŞşŠš]/g, 's')
			  .replace(/[ŢţŤťŦŧ]/g, 't')
			  .replace(/[Ŵŵ]/g, 'w')
			  .replace(/[ŹźŻżŽž]/g, 'z')
			
			// expand umlauts and ligatures
			  .replace(/[ÄÆäæǼǽ]/g, 'ae')
			  .replace(/[ÖöŒœ]/g, 'oe')
			  .replace(/[Üü]/g, 'ue')
			  .replace(/[ß]/g, 'ss')
			  .replace(/[Ĳĳ]/g, 'ij')
			
			// remove single letters (like initials)
			  .replace(/ [A-Za-z0-9] /g, ' ') // does not work recursively, just non-overlapping
			  .replace(/ [A-Za-z0-9] /g, ' ') // needed if there are two consecutive initials!
			  .replace(/^[A-Za-z0-9] /g, '')
			  .replace(/ [A-Za-z0-9]$/g, '');
		},
			
		createMenuList: function(cls, labels, values, selected, showsel) {
			var menulist = document.createElement('menulist');
			if (cls != null)
				menulist.setAttribute('class', cls);
			var menupopup = document.createElement('menupopup');
			if (cls != null)
				menupopup.setAttribute('class', cls);
			for (var index in labels) {
				var menuitem = document.createElement('menuitem');
				menuitem.setAttribute('crop', 'end');
				if (cls != null)
					menuitem.setAttribute('class', cls);
				menuitem.setAttribute('label', labels[index]);
				menuitem.setAttribute('value', values[index]);
				if (values[index] == selected) {
					menuitem.setAttribute('selected' ,'true');
					menupopup.selectedItem = (showsel ? menuitem : null);
				}
				menupopup.appendChild(menuitem);
			}
			menulist.appendChild(menupopup);
			return menulist;
		},
		
		addressBookFields: new Array(
			"FirstName",
			"LastName",
			"DisplayName",
			"PreferDisplayName",
			"PhoneticFirstName",
			"PhoneticLastName",
			"_PhoneticName",
			"NickName",
			"PrimaryEmail",
			"SecondEmail",
			"DefaultEmail",
			"CardType",
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
			"PreferMailFormat",
			"AllowRemoteContent",
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
			"PopularityIndex",
			"Notes")
//			"LastModifiedDate"),
	}
}
