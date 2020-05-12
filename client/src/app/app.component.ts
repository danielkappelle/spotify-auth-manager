import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

  authForm: FormGroup;
  requestForm: FormGroup;
  accessToken: string;
  accessToScopes: string[];

  wrongPass = false;

  scopes = [
    'ugc-image-upload',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'streaming',
    'app-remote-control',
    'user-read-email',
    'user-read-private',
    'playlist-read-collaborative',
    'playlist-modify-public',
    'playlist-read-private',
    'playlist-modify-private',
    'user-library-modify',
    'user-library-read',
    'user-top-read',
    'user-read-playback-position',
    'user-read-recently-played',
    'user-follow-read',
    'user-follow-modify'
  ];

  constructor(
    private formBuilder: FormBuilder,
    private http: HttpClient,
  ) { }

  ngOnInit(): void {
    this.authForm = this.formBuilder.group({
      user: [null, [Validators.required]],
      pass: [null, [Validators.required]],
      scopes: new FormArray([])
    });

    this.requestForm = this.formBuilder.group({
      user: [null, [Validators.required]],
      pass: [null, [Validators.required]]
    });
  }

  public async authorize(): Promise<void> {
    const res: any = await this.http.get(`${environment.apiBaseUrl}/getConfig`).toPromise();
    const clientId: string = res.clientId;
    const redirectUri: string = res.redirectUri;
    const user = this.authForm.get('user').value;
    const pass = this.authForm.get('pass').value;
    const scopes = this.authForm.get('scopes').value.join('%20');

    const state = btoa(JSON.stringify({ user, pass, callback: environment.clientUrl }));

    const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scopes}&state=${state}`;

    window.location.href = authUrl;
    // this.location.go(authUrl);
  }

  public onCheckChange(event): void {
    const formArray: FormArray = this.authForm.get('scopes') as FormArray;

    /* Selected */
    if (event.target.checked) {
      // Add a new control in the arrayForm
      formArray.push(new FormControl(event.target.value));
    } else {
      /* unselected */
      // find the unselected element
      let i = 0;

      formArray.controls.forEach((ctrl: FormControl) => {
        if (ctrl.value === event.target.value) {
          // Remove the unselected element from the arrayForm
          formArray.removeAt(i);
          return;
        }

        i++;
      });
    }
  }

  public async getToken(): Promise<void> {
    this.wrongPass = false;
    this.accessToken = null;
    this.accessToScopes = null;

    const user = this.requestForm.get('user').value;
    const pass = this.requestForm.get('pass').value;

    const authB64 = btoa(`${user}:${pass}`);

    try {
      const res: any = await this.http.get(`${environment.apiBaseUrl}/accessToken`, {
        headers: {
          Authorization: `Basic ${authB64}`
        }
      }).toPromise();

      this.accessToken = res.accessToken;
      this.accessToScopes = res.scope.split(' ');
    } catch {
      this.wrongPass = true;
    }
  }
}
