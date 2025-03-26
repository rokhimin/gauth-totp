
    $(document).ready(function() {
      // Initialize app
      showAccounts();
      updateCodes();
      
      // Start the timer
      setInterval(updateCodes, 1000);
      
      // Close notification
      $(".notification .delete").click(function() {
        $(this).parent().remove();
      });
      
      // Add account button click handler
      $("#add-account").click(function() {
        addAccount();
      });
      
      // Clear all data
      $("#clear-data").click(function() {
        if (confirm("Yakin ingin menghapus semua akun?")) {
          localStorage.removeItem('gauth');
          showAccounts();
        }
      });
    });
    
    // Base32 characters
    var base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    
    // Improved Base32 to Hex conversion
    function base32ToHex(base32) {
      // Remove padding and convert to uppercase
      base32 = base32.replace(/=/g, '').toUpperCase();
      
      var bits = '';
      var hex = '';
      
      // Convert base32 to bits
      for (var i = 0; i < base32.length; i++) {
        var val = base32chars.indexOf(base32.charAt(i));
        if (val === -1) {
          console.error('Invalid Base32 character:', base32.charAt(i));
          throw new Error('Invalid Base32 character');
        }
        
        // Ensure each character adds exactly 5 bits
        bits += leftPad(val.toString(2), 5, '0');
      }
      
      // Pad bits to ensure full bytes (multiple of 8)
      while (bits.length % 8 !== 0) {
        bits += '0';
      }
      
      // Convert bits to hex, ensuring full bytes
      for (var j = 0; j < bits.length; j += 8) {
        var byte = bits.substr(j, 8);
        var hexByte = parseInt(byte, 2).toString(16).padStart(2, '0');
        hex += hexByte;
      }
      
      return hex;
    }
    
    // Left pad with zeros
    function leftPad(str, len, pad) {
      if (len + 1 >= str.length) {
        str = Array(len + 1 - str.length).join(pad) + str;
      }
      return str;
    }
    
    // Convert decimal to hex
    function dec2hex(s) {
      return (s < 15.5 ? '0' : '') + Math.round(s).toString(16);
    }
    
    // Convert hex to decimal
    function hex2dec(s) {
      return parseInt(s, 16);
    }
    
    // Calculate TOTP (Time-based One-Time Password)
    function calcOTP(secret) {
      try {
        // Convert base32 secret to hex
        var key = base32ToHex(secret);
        
        // Get current time in seconds
        var epoch = Math.round(new Date().getTime() / 1000.0);
        
        // Get counter value (30 second period)
        var time = leftPad(dec2hex(Math.floor(epoch / 30)), 16, '0');
        
        // Create hmac using jsSHA
        var hmacObj = new jsSHA(time, "HEX");
        var hmac = hmacObj.getHMAC(key, "HEX", "SHA-1", "HEX");
        
        // Get offset (last nibble of hmac)
        var offset = hex2dec(hmac.substring(hmac.length - 1));
        
        // Get 4 bytes starting at the offset
        var otp = (hex2dec(hmac.substr(offset * 2, 8)) & 0x7fffffff) + "";
        
        // Return the last 6 digits
        return (otp).substr(otp.length - 6, 6);
      } catch (e) {
        console.error("Error calculating OTP:", e);
        console.error("Secret:", secret);
        return "Error";
      }
    }
    
    // Get remaining seconds in current 30-second period
    function getTimeRemaining() {
      var epoch = Math.round(new Date().getTime() / 1000.0);
      var countDown = 30 - (epoch % 30);
      return countDown > 0 ? countDown : 30;
    }
    
    // Add account to localStorage
    function addAccount() {
      var name = $('#account-name').val().trim();
      var secret = $('#secret-key').val().replace(/\s/g, '').toUpperCase();
      
      if (name === "" || secret === "") {
        alert("Silakan isi semua kolom");
        return false;
      }
      
      // Validate secret key
      try {
        // Attempt to generate OTP to verify the secret
        calcOTP(secret);
      } catch (e) {
        alert("Kunci rahasia tidak valid: " + e.message);
        return false;
      }
      
      // Get existing data
      var accounts = JSON.parse(localStorage.getItem('gauth') || '[]');
      
      // Check for duplicates
      for (var i = 0; i < accounts.length; i++) {
        if (accounts[i].name === name) {
          if (!confirm('Akun dengan nama yang sama sudah ada. Ganti?')) {
            return false;
          }
          accounts.splice(i, 1);
          break;
        }
      }
      
      // Add new account
      accounts.push({
        name: name,
        secret: secret
      });
      
      // Save to localStorage
      localStorage.setItem('gauth', JSON.stringify(accounts));
      
      // Reset form
      $('#account-name').val('');
      $('#secret-key').val('');
      
      // Refresh
      showAccounts();
      updateCodes();
      
      return true;
    }
    
    // Delete an account
    function deleteAccount(index) {
      if (confirm('Anda yakin ingin menghapus akun ini?')) {
        var accounts = JSON.parse(localStorage.getItem('gauth') || '[]');
        accounts.splice(index, 1);
        localStorage.setItem('gauth', JSON.stringify(accounts));
        showAccounts();
      }
    }
    
    // Display accounts
    function showAccounts() {
      var accounts = JSON.parse(localStorage.getItem('gauth') || '[]');
      var container = $('#tokens-container');
      container.empty();
      
      if (accounts.length === 0) {
        container.append('<div class="notification is-info is-light has-text-centered">Belum ada akun yang ditambahkan</div>');
        return;
      }
      
      for (var i = 0; i < accounts.length; i++) {
        var account = accounts[i];
        var card = $(`
          <div class="card" data-index="${i}">
            <div class="card-content">
              <div class="level is-mobile">
                <div class="level-left">
                  <div class="level-item">
                    <p class="title is-5">${account.name}</p>
                  </div>
                </div>
                <div class="level-right">
                  <div class="level-item">
                    <span class="delete delete-button"></span>
                  </div>
                </div>
              </div>
              <div class="content">
                <div class="token-container">
                  <div class="token" id="token-${i}">------</div>
                </div>
                <div class="progress-container">
                  <progress class="progress is-link" id="progress-${i}" value="30" max="30"></progress>
                </div>
              </div>
            </div>
          </div>
        `);
        
        container.append(card);
        
        // Add delete button handler
        card.find('.delete-button').click(function() {
          var index = $(this).closest('.card').data('index');
          deleteAccount(index);
        });
      }
      
      // Update codes immediately
      updateCodes();
    }
    
    // Update OTP codes and progress
    function updateCodes() {
      var accounts = JSON.parse(localStorage.getItem('gauth') || '[]');
      var remaining = getTimeRemaining();
      
      for (var i = 0; i < accounts.length; i++) {
        try {
          var token = calcOTP(accounts[i].secret);
          $('#token-' + i).text(token);
          $('#progress-' + i).val(remaining);
        } catch (e) {
          $('#token-' + i).text('Error');
          console.error('Error updating token for account ' + i, e);
        }
      }
    }
